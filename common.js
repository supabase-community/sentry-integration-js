export function isPlainObject(wat) {
  return Object.prototype.toString.call(wat) === "[object Object]";
}

export const AVAILABLE_OPERATIONS = [
  "select",
  "insert",
  "upsert",
  "update",
  "delete",
];

export const DEFAULT_OPTIONS = {
  tracing: true,
  breadcrumbs: true,
  errors: false,
  operations: [...AVAILABLE_OPERATIONS],
  shouldCreateSpan: undefined,
  shouldCreateBreadcrumb: undefined,
  sanitizeBody: undefined,
};

export function validateOption(availableOptions, key, value) {
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
      "shouldCreateSpan should be a function that returns a boolean"
    );
  }

  if (key === "shouldCreateBreadcrumb" && typeof value !== "function") {
    throw new TypeError(
      "shouldCreateBreadcrumb should be a function that returns a boolean"
    );
  }

  if (key === "sanitizeBody" && typeof value !== "function") {
    throw new TypeError(
      "sanitizeBody should be a function that returns a valid data object"
    );
  }
}

export function extractOperation(method, headers = {}) {
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
}

export const FILTER_MAPPINGS = {
  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  like: "like",
  "like(all)": "likeAllOf",
  "like(any)": "likeAnyOf",
  ilike: "ilike",
  "ilike(all)": "ilikeAllOf",
  "ilike(any)": "ilikeAnyOf",
  is: "is",
  in: "in",
  cs: "contains",
  cd: "containedBy",
  sr: "rangeGt",
  nxl: "rangeGte",
  sl: "rangeLt",
  nxr: "rangeLte",
  adj: "rangeAdjacent",
  ov: "overlaps",
  fts: "",
  plfts: "plain",
  phfts: "phrase",
  wfts: "websearch",
  not: "not",
};

export function translateFiltersIntoMethods(key, query) {
  if (query === "" || query === "*") {
    return `select(*)`;
  }

  if (key === "select") {
    return `select(${query})`;
  }

  if (key === "or" || key.endsWith(".or")) {
    return `${key}${query}`;
  }

  const [filter, ...value] = query.split(".");

  let method;
  // Handle optional `configPart` of the filter
  if (filter.startsWith("fts")) {
    method = "textSearch";
  } else if (filter.startsWith("plfts")) {
    method = "textSearch[plain]";
  } else if (filter.startsWith("phfts")) {
    method = "textSearch[phrase]";
  } else if (filter.startsWith("wfts")) {
    method = "textSearch[websearch]";
  } else {
    method = FILTER_MAPPINGS[filter] || "filter";
  }

  return `${method}(${key}, ${value.join(".")})`;
}
