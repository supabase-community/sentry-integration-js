import {
  AVAILABLE_OPERATIONS,
  DEFAULT_OPTIONS,
  extractOperation,
  isPlainObject,
  translateFiltersIntoMethods,
  validateOption,
} from "./common.js";

export class SupabaseIntegration {
  static id = "SupabaseIntegration";
  name = SupabaseIntegration.id;
  instrumented = new Map();
  options = { ...DEFAULT_OPTIONS };

  constructor(SupabaseClient, options = {}) {
    if (!SupabaseClient) {
      throw new Error("SupabaseClient class constructor is required");
    }

    // We want to allow passing either `SupabaseClient` constructor
    // or an instance returned from `createClient()`.
    if (SupabaseClient.constructor === Function) {
      this.SupabaseClient = SupabaseClient;
    } else {
      this.SupabaseClient = SupabaseClient.constructor;
    }

    if (!isPlainObject(options)) {
      throw new TypeError(`SupabaseIntegration options should be an object`);
    }

    const availableOptions = Object.keys(this.options);
    for (const [key, value] of Object.entries(options)) {
      validateOption(availableOptions, key, value);
      this.options[key] = value;
    }
  }

  setupOnce(_, getCurrentHub) {
    this.instrumentSupabaseClient(this.SupabaseClient, getCurrentHub);
  }

  // Used only for testing purposes, as in the real world, everything would be only wrapped once,
  // with a predefined set of options, where in tests we need to test different variants in the same env.
  _restore() {
    for (const [obj, methods] of this.instrumented.entries()) {
      for (const [method, impl] of Object.entries(methods)) {
        obj.prototype[method] = impl;
      }
    }
  }

  instrumentSupabaseClient(SupabaseClient, getCurrentHub) {
    if (this.instrumented.has(SupabaseClient)) {
      return;
    }

    this.instrumented.set(SupabaseClient, {
      from: SupabaseClient.prototype.from,
    });

    const self = this;
    SupabaseClient.prototype.from = new Proxy(SupabaseClient.prototype.from, {
      apply(target, thisArg, argumentsList) {
        const rv = Reflect.apply(target, thisArg, argumentsList);
        const PostgrestQueryBuilder = rv.constructor;

        self.instrumentPostgrestQueryBuilder(
          PostgrestQueryBuilder,
          getCurrentHub
        );

        return rv;
      },
    });
  }

  instrumentPostgrestQueryBuilder(PostgrestQueryBuilder, getCurrentHub) {
    if (this.instrumented.has(PostgrestQueryBuilder)) {
      return;
    }

    // We need to wrap _all_ operations despite them sharing the same `PostgrestFilterBuilder`
    // constructor, as we don't know which method will be called first, an we don't want to miss any calls.
    for (const operation of AVAILABLE_OPERATIONS) {
      this.instrumented.set(PostgrestQueryBuilder, {
        [operation]: PostgrestQueryBuilder.prototype[operation],
      });

      const self = this;
      PostgrestQueryBuilder.prototype[operation] = new Proxy(
        PostgrestQueryBuilder.prototype[operation],
        {
          apply(target, thisArg, argumentsList) {
            const rv = Reflect.apply(target, thisArg, argumentsList);
            const PostgrestFilterBuilder = rv.constructor;

            self.instrumentPostgrestFilterBuilder(
              PostgrestFilterBuilder,
              getCurrentHub
            );

            return rv;
          },
        }
      );
    }
  }

  // This is the only "instrumented" part of the SDK. The rest of instrumentation
  // methods are only used as a mean to get to the `PostgrestFilterBuilder` constructor itself.
  instrumentPostgrestFilterBuilder(PostgrestFilterBuilder, getCurrentHub) {
    if (this.instrumented.has(PostgrestFilterBuilder)) {
      return;
    }

    this.instrumented.set(PostgrestFilterBuilder, {
      then: PostgrestFilterBuilder.prototype.then,
    });

    const self = this;
    PostgrestFilterBuilder.prototype.then = new Proxy(
      PostgrestFilterBuilder.prototype.then,
      {
        apply(target, thisArg, argumentsList) {
          const operations = self.options.operations;
          const operation = extractOperation(thisArg.method, thisArg.headers);

          if (!operations.includes(operation)) {
            return Reflect.apply(target, thisArg, argumentsList);
          }

          const table = thisArg.url.pathname.split("/").slice(-1)[0];
          const description = `from(${table})`;

          const query = [];
          for (const [key, value] of thisArg.url.searchParams.entries()) {
            // It's possible to have multiple entries for the same key, eg. `id=eq.7&id=eq.3`,
            // so we need to use array instead of object to collect them.
            query.push(translateFiltersIntoMethods(key, value));
          }

          const body = {};
          if (isPlainObject(thisArg.body)) {
            for (const [key, value] of Object.entries(thisArg.body)) {
              body[key] =
                typeof self.options.sanitizeBody === "function"
                  ? self.options.sanitizeBody(table, key, value)
                  : value;
            }
          }

          const shouldCreatePayload = {
            method: thisArg.method,
            url: thisArg.url,
            headers: thisArg.headers,
            schema: thisArg.schema,
            body: thisArg.body,
          };

          const shouldCreateSpan =
            typeof self.options.shouldCreateSpan === "function"
              ? self.options.shouldCreateSpan(shouldCreatePayload)
              : true;

          let span;

          if (self.options.tracing && shouldCreateSpan) {
            const scope = getCurrentHub().getScope();
            const transaction = scope.getTransaction();

            const data = {
              "db.table": table,
              "db.schema": thisArg.schema,
              "db.url": thisArg.url.origin,
              "db.sdk": thisArg.headers["X-Client-Info"],
            };

            if (query.length) {
              data["db.query"] = query;
            }

            if (Object.keys(body).length) {
              data["db.body"] = body;
            }

            span = transaction?.startChild({
              description,
              op: `db.${operation}`,
              origin: "auto.db.supabase",
              data,
            });
          }

          return Reflect.apply(target, thisArg, [])
            .then(
              (res) => {
                span?.setHttpStatus(res.status);
                span?.finish();

                if (self.options.errors && res.error) {
                  const err = new Error(res.error.message);
                  if (res.error.code) {
                    err.code = res.error.code;
                  }
                  if (res.error.details) {
                    err.details = res.error.details;
                  }

                  const supabaseContext = {};
                  if (query.length) {
                    supabaseContext["query"] = query;
                  }
                  if (Object.keys(body).length) {
                    supabaseContext["body"] = body;
                  }
                  getCurrentHub().captureException(err, {
                    contexts: {
                      supabase: supabaseContext,
                    },
                  });
                }

                const shouldCreateBreadcrumb =
                  typeof self.options.shouldCreateBreadcrumb === "function"
                    ? self.options.shouldCreateBreadcrumb(shouldCreatePayload)
                    : true;

                if (self.options.breadcrumbs && shouldCreateBreadcrumb) {
                  const breadcrumb = {
                    type: "supabase",
                    category: `db.${operation}`,
                    message: description,
                  };

                  const data = {};

                  if (query.length) {
                    data["query"] = query;
                  }

                  if (Object.keys(body).length) {
                    data["body"] = body;
                  }

                  if (Object.keys(data).length) {
                    breadcrumb["data"] = data;
                  }

                  getCurrentHub().addBreadcrumb(breadcrumb);
                }

                return res;
              },
              (err) => {
                span?.setHttpStatus(500);
                span?.finish();
                throw err;
              }
            )
            .then(...argumentsList);
        },
      }
    );
  }
}
