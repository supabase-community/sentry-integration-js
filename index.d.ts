import { type SupabaseClient } from "@supabase/supabase-js";
import { type PostgrestBuilder } from "@supabase/postgrest-js";

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
export class SupabaseIntegration {
  constructor(
    clientConstructor: SupabaseClient,
    options: {
      tracing?: boolean;
      errors?: boolean;
      breadcrumbs?: boolean;
      operations?: ["select" | "insert" | "upsert" | "update" | "delete"][];
      shouldCreateSpan: (builder: PostgrestBuilder<unknown>) => boolean;
      shouldCreateBreadcrumb: (builder: PostgrestBuilder<unknown>) => boolean;
      sanitizeBody(key: string, value: unknown): any;
    }
  );
}
