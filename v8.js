import {
  AVAILABLE_OPERATIONS,
  DEFAULT_OPTIONS,
  extractOperation,
  isPlainObject,
  translateFiltersIntoMethods,
  validateOption,
} from "./common.js";

export function supabaseIntegration(SupabaseClient, Sentry, userOptions = {}) {
  if (!SupabaseClient) {
    throw new Error("SupabaseClient class constructor is required");
  }

  // We want to allow passing either `SupabaseClient` constructor
  // or an instance returned from `createClient()`.
  SupabaseClient =
    SupabaseClient.constructor === Function
      ? SupabaseClient
      : SupabaseClient.constructor;

  if (!isPlainObject(userOptions)) {
    throw new TypeError(`SupabaseIntegration options should be an object`);
  }

  const options = { ...DEFAULT_OPTIONS };
  const availableOptions = Object.keys(DEFAULT_OPTIONS);
  for (const [key, value] of Object.entries(userOptions)) {
    validateOption(availableOptions, key, value);
    options[key] = value;
  }
  const instrumented = new Map();

  // Used only for testing purposes, as in the real world, everything would be only wrapped once,
  // with a predefined set of options, where in tests we need to test different variants in the same env.
  function _restore() {
    for (const [obj, methods] of instrumented.entries()) {
      for (const [method, impl] of Object.entries(methods)) {
        obj.prototype[method] = impl;
      }
    }
  }

  function instrumentSupabaseClient(SupabaseClient, getCurrentHub) {
    if (instrumented.has(SupabaseClient)) {
      return;
    }

    instrumented.set(SupabaseClient, {
      from: SupabaseClient.prototype.from,
    });

    SupabaseClient.prototype.from = new Proxy(SupabaseClient.prototype.from, {
      apply(target, thisArg, argumentsList) {
        const rv = Reflect.apply(target, thisArg, argumentsList);
        const PostgrestQueryBuilder = rv.constructor;

        instrumentPostgrestQueryBuilder(PostgrestQueryBuilder, getCurrentHub);

        return rv;
      },
    });
  }

  function instrumentPostgrestQueryBuilder(PostgrestQueryBuilder) {
    if (instrumented.has(PostgrestQueryBuilder)) {
      return;
    }

    // We need to wrap _all_ operations despite them sharing the same `PostgrestFilterBuilder`
    // constructor, as we don't know which method will be called first, an we don't want to miss any calls.
    for (const operation of AVAILABLE_OPERATIONS) {
      instrumented.set(PostgrestQueryBuilder, {
        [operation]: PostgrestQueryBuilder.prototype[operation],
      });

      PostgrestQueryBuilder.prototype[operation] = new Proxy(
        PostgrestQueryBuilder.prototype[operation],
        {
          apply(target, thisArg, argumentsList) {
            const rv = Reflect.apply(target, thisArg, argumentsList);
            const PostgrestFilterBuilder = rv.constructor;

            instrumentPostgrestFilterBuilder(PostgrestFilterBuilder);

            return rv;
          },
        }
      );
    }
  }

  // This is the only "instrumented" part of the SDK. The rest of instrumentation
  // methods are only used as a mean to get to the `PostgrestFilterBuilder` constructor itself.
  function instrumentPostgrestFilterBuilder(PostgrestFilterBuilder) {
    if (instrumented.has(PostgrestFilterBuilder)) {
      return;
    }

    instrumented.set(PostgrestFilterBuilder, {
      then: PostgrestFilterBuilder.prototype.then,
    });

    PostgrestFilterBuilder.prototype.then = new Proxy(
      PostgrestFilterBuilder.prototype.then,
      {
        apply(target, thisArg, argumentsList) {
          const operations = options.operations;
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
                typeof options.sanitizeBody === "function"
                  ? options.sanitizeBody(table, key, value)
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
            typeof options.shouldCreateSpan === "function"
              ? options.shouldCreateSpan(shouldCreatePayload)
              : true;

          let span;

          if (options.tracing && shouldCreateSpan) {
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

            span = Sentry.startInactiveSpan({
              description,
              op: `db.${operation}`,
              origin: "auto.db.supabase",
              data,
            });
          }

          return Reflect.apply(target, thisArg, [])
            .then(
              (res) => {
                if (span) {
                  setHttpStatus(span, res.status);
                  span.end();
                }

                if (options.errors && res.error) {
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

                  Sentry.captureException(err, {
                    contexts: {
                      supabase: supabaseContext,
                    },
                  });
                }

                const shouldCreateBreadcrumb =
                  typeof options.shouldCreateBreadcrumb === "function"
                    ? options.shouldCreateBreadcrumb(shouldCreatePayload)
                    : true;

                if (options.breadcrumbs && shouldCreateBreadcrumb) {
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

                  Sentry.addBreadcrumb(breadcrumb);
                }

                return res;
              },
              (err) => {
                if (span) {
                  setHttpStatus(span, 500);
                  span.end();
                }
                throw err;
              }
            )
            .then(...argumentsList);
        },
      }
    );
  }

  return {
    name: "SupabaseIntegration",
    setupOnce() {
      instrumentSupabaseClient(SupabaseClient);
    },
    _restore,
  };
}

const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

function getSpanStatusFromHttpCode(httpStatus) {
  if (httpStatus < 400 && httpStatus >= 100) {
    return { code: SPAN_STATUS_OK };
  }

  if (httpStatus >= 400 && httpStatus < 500) {
    switch (httpStatus) {
      case 401:
        return { code: SPAN_STATUS_ERROR, message: "unauthenticated" };
      case 403:
        return { code: SPAN_STATUS_ERROR, message: "permission_denied" };
      case 404:
        return { code: SPAN_STATUS_ERROR, message: "not_found" };
      case 409:
        return { code: SPAN_STATUS_ERROR, message: "already_exists" };
      case 413:
        return { code: SPAN_STATUS_ERROR, message: "failed_precondition" };
      case 429:
        return { code: SPAN_STATUS_ERROR, message: "resource_exhausted" };
      case 499:
        return { code: SPAN_STATUS_ERROR, message: "cancelled" };
      default:
        return { code: SPAN_STATUS_ERROR, message: "invalid_argument" };
    }
  }

  if (httpStatus >= 500 && httpStatus < 600) {
    switch (httpStatus) {
      case 501:
        return { code: SPAN_STATUS_ERROR, message: "unimplemented" };
      case 503:
        return { code: SPAN_STATUS_ERROR, message: "unavailable" };
      case 504:
        return { code: SPAN_STATUS_ERROR, message: "deadline_exceeded" };
      default:
        return { code: SPAN_STATUS_ERROR, message: "internal_error" };
    }
  }

  return { code: SPAN_STATUS_ERROR, message: "unknown_error" };
}

function setHttpStatus(span, httpStatus) {
  span.setAttribute("http.response.status_code", httpStatus);

  const spanStatus = getSpanStatusFromHttpCode(httpStatus);
  if (spanStatus.message !== "unknown_error") {
    span.setStatus(spanStatus);
  }
}
