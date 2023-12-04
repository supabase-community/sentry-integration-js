<br/>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logos/supabase-wordmark--dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="logos/supabase-wordmark--light.svg">
    <img alt="Supabase logo" src="logos/supabase-wordmark--dark.svg" width="320">
  </picture>
  <br />
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logos/sentry-wordmark--dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="logos/sentry-wordmark--light.svg">
    <img alt="Sentry logo" src="logos/sentry-wordmark--dark.svg" width="256">
  </picture>
</p>

# @supabase/sentry-js-integration

Sentry JavaScript SDK Integration that can be used to instrument Supabase JavaScript SDK and collect traces, breadcrumbs and errors.

See [Showcase](#showcase) section for detailed screenshots of what is captured.

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
- `shouldCreateSpan: (payload) => boolean` - Decide whether a span should be created based on the query payload used to capture this data
- `shouldCreateBreadcrumb: (payload) => boolean` - Decide whether a breadcrumb should be created based on the query payload used to capture this data
- `sanitizeBody: (table, key, value) => value` - Allows for modifying captured body values that are passed to `insert/upsert/update` operations, before assigned to a `span`, `breadcrumb`, or `error

### Removing duplicated http/fetch spans

If you are using built-in `Http`, `Fetch` or `Undici` integrations in your current Sentry setup, you might want to skip some of the spans that will be already covered by `SupabaseIntegration`. Here's a quick snippet how to do that:

```js
// @sentry/browser
new Sentry.BrowserTracing({
  shouldCreateSpanForRequest: (url) => {
    return !url.startsWith(SUPABASE_URL);
  },
});

// or @sentry/node
new Sentry.Integrations.Http({
  tracing: {
    shouldCreateSpanForRequest: (url) => {
      return !url.startsWith(SUPABASE_URL);
    },
  },
});

// or @sentry/node with Fetch support
new Sentry.Integrations.Undici({
  shouldCreateSpanForRequest: (url) => {
    return !url.startsWith(SUPABASE_URL);
  },
});
```

## Showcase

_(click to enlarge image)_

### Server-side Traces

<table>
  <tr>
    <td valign="top"><img src="screenshots/server-side.png" width="320"></td>
    <td valign="top"><img src="screenshots/server-side-details.png" width="320"></td>
  </tr>
</table>

### Client-side Traces

<table>
  <tr>
    <td valign="top"><img src="screenshots/client-side.png" width="320"></td>
    <td valign="top"><img src="screenshots/client-side-details.png" width="320"></td>
  </tr>
</table>

### Capturing Non-throwable Errors

<table>
  <tr>
    <td valign="top"><img src="screenshots/errors.png" width="320"></td>
  </tr>
</table>

### Breadcrumbs

<table>
  <tr>
    <td valign="top"><img src="screenshots/breadcrumbs.png" width="320"></td>
  </tr>
</table>

### Payload Sanitization

<table>
  <tr>
    <td valign="top"><img src="screenshots/body-sanitization.png" width="320"></td>
  </tr>
</table>
