// TODO: Add ability to rely on postgrest-js objects directly instead?
// TODO: Query to sdk method mappings

const isPlainObject = (wat) =>
  Object.prototype.toString(wat) === "[object Object]";

const extractOperation = (method, headers = {}) => {
  switch (method) {
    case "GET": {
      return "select";
    }
    case "POST": {
      if (headers["Prefer"]?.includes("resolution=")) {
        return "upsert";
      } else {
        return "insert";
      }
    }
    case "PATCH": {
      return "update";
    }
    case "DELETE": {
      return "delete";
    }
  }
};

const AVAILABLE_OPERATIONS = ["select", "insert", "upsert", "update", "delete"];

function validateOption(availableOptions, key, value) {
  if (!availableOptions.includes(key)) {
    throw new Error(`Unknown option: ${key}`);
  }

  if (key === "operations") {
    if (!Array.isArray(value)) {
      throw new TypeError(`operations should be an array`);
    }

    for (const operation of value) {
      if (!AVAILABLE_OPERATIONS.includes(operation)) {
        throw new Error(`Unknown operation: ${operation}`);
      }
    }
  }

  if (key === "shouldCreateSpan" && typeof value !== "function") {
    throw new TypeError(
      "shouldCreateSpan should be a function that returns a boolean",
    );
  }

  if (key === "shouldCreateBreadcrumb" && typeof value !== "function") {
    throw new TypeError(
      "shouldCreateBreadcrumb should be a function that returns a boolean",
    );
  }

  if (key === "sanitizeData" && typeof value !== "function") {
    throw new TypeError(
      "sanitizeData should be a function that returns a valid data object",
    );
  }
}

export class SupabaseIntegration {
  static id = "SupabaseIntegration";
  name = SupabaseIntegration.id;
  instrumented = new Map();
  options = {
    tracing: true,
    breadcrumbs: false,
    errors: false,
    operations: [...AVAILABLE_OPERATIONS],
    shouldCreateSpan: undefined,
    shouldCreateBreadcrumb: undefined,
    sanitizeData: undefined,
  };

  constructor(SupabaseClient, options = {}) {
    if (!SupabaseClient) {
      throw new Error("SupabaseClient class constructor is required");
    }
    this.SupabaseClient = SupabaseClient;

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
          getCurrentHub,
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
              getCurrentHub,
            );

            return rv;
          },
        },
      );
    }
  }

  // This is the only "instrumented" part of the SDK. The rest of instrumentation
  // methods are only used as a mean to get to the `PostgrestFilterBuilder` constructor intself.
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
          const query = Object.fromEntries(thisArg.url.searchParams);

          const shouldCreateSpan =
            typeof self.options.shouldCreateSpan === "function"
              ? self.options.shouldCreateSpan(thisArg)
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

            if (Object.keys(query).length) {
              data["db.query"] = query;
            }

            if (thisArg.body) {
              data["db.body"] = thisArg.body;
            }

            span = transaction?.startChild({
              description,
              op: `db.${operation}`,
              origin: "auto.db.supabase",
              data:
                typeof self.options.sanitizeData === "function"
                  ? self.options.sanitizeData(data)
                  : data,
            });
          }

          return Reflect.apply(target, thisArg, [])
            .then(
              (res) => {
                span?.setHttpStatus(res.status);
                span?.finish();

                if (self.options.errors && res.error) {
                  const err = new Error(res.error.message);
                  err.code = res.error.code;
                  err.details = res.error.details;
                  getCurrentHub().captureException(err);
                }

                const shouldCreateBreadcrumb =
                  typeof self.options.shouldCreateBreadcrumb === "function"
                    ? self.options.shouldCreateBreadcrumb(thisArg)
                    : true;

                if (self.options.breadcrumbs && shouldCreateBreadcrumb) {
                  const breadcrumb = {
                    type: "supabase",
                    category: `db.${operation}`,
                    message: description,
                  };

                  const data = {};

                  if (Object.keys(query).length) {
                    data["query"] = query;
                  }

                  if (thisArg.body) {
                    data["body"] = thisArg.body;
                  }

                  if (Object.keys(data).length) {
                    breadcrumb["data"] =
                      typeof self.options.sanitizeData === "function"
                        ? self.options.sanitizeData(data)
                        : data;
                  }

                  getCurrentHub().addBreadcrumb(breadcrumb);
                }

                return res;
              },
              (err) => {
                span?.setHttpStatus(500);
                span?.finish();
                throw err;
              },
            )
            .then(...argumentsList);
        },
      },
    );
  }
}
