import { SupabaseClient } from "@supabase/supabase-js";
import type { EventProcessor, Hub, Integration } from "@sentry/types";

type IntegrationOptions = {
  tracing: boolean;
  errors: boolean;
  breadcrumbs: boolean;
  operations: ["select" | "insert" | "upsert" | "update" | "delete"][];
  shouldCreateSpan: (payload: Payload) => boolean;
  shouldCreateBreadcrumb: (payload: Payload) => boolean;
  sanitizeBody(table: string, key: string, value: unknown): any;
};

/**
@returns Sentry JavaScript SDK v8 Integration that can be used to instrument Supabase JavaScript SDK instrumentation.

https://docs.sentry.io/platforms/javascript/configuration/integrations/

@example
```
import * as Sentry from "@sentry/browser";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    new supabaseIntegration(SupabaseClient, Sentry, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],
});
```
*/
export function supabaseIntegration(
  SupabaseClient: any,
  SentryNamespace: {
    startInactiveSpan: (...args: any[]) => any;
    captureException: (...args: any[]) => any;
    addBreadcrumb: (...args: any[]) => any;
  },
  options?: Partial<IntegrationOptions>
);

/**
@returns Sentry JavaScript SDK v7 Integration that can be used to instrument Supabase JavaScript SDK instrumentation.

https://docs.sentry.io/platforms/javascript/configuration/integrations/

@example
```
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
*/
export class SupabaseIntegration implements Integration {
  name: string;
  constructor(SupabaseClient: any, options?: Partial<IntegrationOptions>);
  setupOnce(): void;
  setupOnce(
    addGlobalEventProcessor: (callback: EventProcessor) => void,
    getCurrentHub: () => Hub
  ): void;
}

export type Payload = {
  method: "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";
  url: URL;
  headers: Record<string, string>;
  schema?: string;
  body?: unknown;
};
