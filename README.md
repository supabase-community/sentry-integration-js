# supabase-sentry-integration

<img src="./img.png" width="512">

Sentry JavaScript SDK Integration that can be used to instrument Supabase JavaScript SDK instrumentation.

## Install

```sh
npm install TBD
```

## Usage

```js
import { SupabaseIntegration } from "@supabase/sentry-integration";
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

- `tracing: boolean` - Enable tracing instrumentation for database calls
- `breadcrumbs: boolean` - Enable capturing breadcrumbs for database calls
- `errors: boolean` - Enable capturing non-throwable database errors as Sentry exceptions
- `operations: "select" | insert" | "upsert" | "update" | "delete"` - Configures which methods should be instrumented for the features above
- `shouldCreateSpan: (builder) => boolean` - Decide whether a span should be created based on the query builder used to capture this data
- `shouldCreateBreadcrumb: (builder) => boolean` - Decide whether a breadcrumb should be created based on the query builder used to capture this data
- `sanitizeData: (data) => data` - Modifies data assigned to each span/breadcrumb before sending it to Sentry
