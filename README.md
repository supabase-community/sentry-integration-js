<picture>
  <source media="(prefers-color-scheme: dark)" srcset="supabase-wordmark--dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="supabase-wordmark--light.svg">
  <img alt="Supabase logo" src="supabase-wordmark--dark.svg" width="256">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="sentry-wordmark--dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="sentry-wordmark--light.svg">
  <img alt="Sentry logo" src="sentry-wordmark--dark.svg" width="256">
</picture>

# @supabase/sentry-js-integration

Sentry JavaScript SDK Integration that can be used to instrument Supabase JavaScript SDK instrumentation.

## Install

```sh
npm install @supabase/sentry-js-integration
```

## Usage

```js
import { SupabaseIntegration } from "@supabase/sentry-js-integration";
import { SupabaseClient } from "@supabase/supabase-js";

Sentry.init({
  dsn: "https://dsn@sentry.io/1337",
  integrations: [
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],
});
```

## Options

- `tracing: boolean` - Enable tracing instrumentation for database calls _(defaults to **true**)_
- `breadcrumbs: boolean` - Enable capturing breadcrumbs for database calls _(defaults to **true**)_
- `errors: boolean` - Enable capturing non-throwable database errors as Sentry exceptions _(defaults to **false**)_
- `operations: "select" | insert" | "upsert" | "update" | "delete"` - Configures which methods should be instrumented for the features above _(defaults to **all operations**)_
- `shouldCreateSpan: (builder) => boolean` - Decide whether a span should be created based on the query builder used to capture this data
- `shouldCreateBreadcrumb: (builder) => boolean` - Decide whether a breadcrumb should be created based on the query builder used to capture this data
- `sanitizeBody: (key, value) => value` - Allows for modifying captured body values that are passed to `insert/upsert/update` operations, before assigned to a `span`, `breadcrumb`, or `error
