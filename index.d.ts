import { SupabaseClient } from "@supabase/supabase-js";
import { EventProcessor, Hub, Integration } from "@sentry/types";

/**
@returns Sentry JavaScript SDK Integration that can be used to instrument Supabase JavaScript SDK instrumentation.

https://docs.sentry.io/platforms/javascript/configuration/integrations/

@example
```
import { SupabaseIntegration } from '@supabase/sentry-integration';
import { SupabaseClient } from '@supabase/supabase-js';

Sentry.init({
  dsn: "https://dsn@sentry.io/1337",
  integrations: [new SupabaseIntegration(SupabaseClient, {
    tracing: true,
    breadcrumbs: true,
    errors: true
  })]
});
```
*/
export class SupabaseIntegration implements Integration {
  name: string;
  constructor(
    clientConstructor: typeof SupabaseClient,
    options?: Partial<{
      tracing: boolean;
      errors: boolean;
      breadcrumbs: boolean;
      operations: ["select" | "insert" | "upsert" | "update" | "delete"][];
      shouldCreateSpan: (payload: Payload) => boolean;
      shouldCreateBreadcrumb: (payload: Payload) => boolean;
      sanitizeBody(table: string, key: string, value: unknown): any;
    }>
  );
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
