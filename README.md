<br/>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logos/supabase-wordmark--dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="logos/supabase-wordmark--light.svg" />
    <img alt="Supabase logo" src="logos/supabase-wordmark--dark.svg" width="320" />
  </picture>
  <br />
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logos/sentry-wordmark--dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="logos/sentry-wordmark--light.svg" />
    <img alt="Sentry logo" src="logos/sentry-wordmark--dark.svg" width="256" />
  </picture>
</p>

# @supabase/sentry-js-integration

Sentry JavaScript SDK Integration that can be used to instrument Supabase JavaScript SDK and collect traces, breadcrumbs and errors. The integration supports browser, Node, and edge environments.

See [Showcase](#showcase) section for detailed screenshots of what is captured.

## Install

```sh
npm install @supabase/sentry-js-integration
```

## Usage

```js
import * as Sentry from "@sentry/browser";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],
});
```

or

```js
import * as Sentry from "@sentry/browser";
import { createClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    new SupabaseIntegration(supabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],
});
```

## Options

| Option | Description | Default |
| ------------- | ------------- | ------------- |
| `tracing` | Enable tracing instrumentation for database calls | **true** |
| `breadcrumbs` | Enable capturing breadcrumbs for database calls | **true** |
| `errors` | Enable capturing non-throwable database errors as Sentry exceptions | **false** |
| `operations` | Configures which methods should be instrumented for the features above | - |
| `sanitizeBody` | Allows for modifying captured body values that are passed to insert, upsert, and update operations, before assigned to a span, breadcrumb, or error | - |
| `shouldCreateSpan` | Decide whether a span should be created based on the query payload used to capture this data | - |
| `shouldCreateBreadcrumb` | Decide whether a breadcrumb should be created based on the query payload used to capture this data | - |

See https://github.com/supabase-community/sentry-integration-js/blob/master/index.d.ts for detailed options types.

### Removing duplicated http/fetch spans

If you are using built-in `Http`, `Fetch` or `Undici` integrations in your current Sentry setup, you might want to skip some of the spans that will be already covered by `SupabaseIntegration`. Here's a quick snippet how to do that:

```js
import * as Sentry from "@sentry/browser";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),

    // @sentry/browser
    new Sentry.BrowserTracing({
      shouldCreateSpanForRequest: (url) => {
        return !url.startsWith(`${SUPABASE_URL}/rest`);
      },
    }),

    // or @sentry/node
    new Sentry.Integrations.Http({
      tracing: {
        shouldCreateSpanForRequest: (url) => {
          return !url.startsWith(`${SUPABASE_URL}/rest`);
        },
      },
    }),

    // or @sentry/node with Fetch support
    new Sentry.Integrations.Undici({
      shouldCreateSpanForRequest: (url) => {
        return !url.startsWith(`${SUPABASE_URL}/rest`);
      },
    }),

    // or @sentry/WinterCGFetch for Next.js Middleware & Edge Functions
    new Sentry.Integrations.WinterCGFetch({
      breadcrumbs: true,
      shouldCreateSpanForRequest: (url) => {
        return !url.startsWith(`${SUPABASE_URL}/rest`);
      },
    }),
  ],
});
```

<details>
  <summary>
    <h2>Example Next.js configuration</h2>
  </summary>

See this example for a setup with Next.js to cover browser, server, and edge environments. First, run through the [Sentry Next.js wizard](https://docs.sentry.io/platforms/javascript/guides/nextjs/#install) to generate the base Next.js configuration. Then add the Supabase Sentry Integration to all your `Sentry.init` calls with the appropriate filters.

`sentry.client.config.ts`

```js sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: true,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
    new Sentry.BrowserTracing({
      shouldCreateSpanForRequest: (url) => {
        return !url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest`);
      },
    }),
  ],
});
```

`sentry.server.config.ts`

```js sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
    new Sentry.Integrations.Undici({
      shouldCreateSpanForRequest: (url) => {
        console.log(
          "server",
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest`,
          url
        );
        return !url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest`);
      },
    }),
  ],

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: true,
});
```

`sentry.edge.config.ts`

```js sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
    new Sentry.Integrations.WinterCGFetch({
      breadcrumbs: true,
      shouldCreateSpanForRequest: (url) => {
        return !url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest`);
      },
    }),
  ],
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: true,
});
```

Afterward build your application (`npm run build`) and start it locally (`npm run start`). You will now see the transactions being logged in the terminal when making supabase-js requests.

</details>

## Showcase

_(click to enlarge image)_

### Server-side Traces

<table>
  <tr>
    <td valign="top"><img src="screenshots/server-side.png" width="320" /></td>
    <td valign="top"><img src="screenshots/server-side-details.png" width="320" /></td>
  </tr>
</table>

### Client-side Traces

<table>
  <tr>
    <td valign="top"><img src="screenshots/client-side.png" width="320" /></td>
    <td valign="top"><img src="screenshots/client-side-details.png" width="320" /></td>
  </tr>
</table>

### Capturing Non-throwable Errors

<table>
  <tr>
    <td valign="top"><img src="screenshots/errors.png" width="320" /></td>
  </tr>
</table>

### Breadcrumbs

<table>
  <tr>
    <td valign="top"><img src="screenshots/breadcrumbs.png" width="320" /></td>
  </tr>
</table>

### Payload Sanitization

<table>
  <tr>
    <td valign="top"><img src="screenshots/body-sanitization.png" width="320" /></td>
  </tr>
</table>
