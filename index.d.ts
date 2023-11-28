import { type SupabaseClient } from "@supabase/supabase-js";

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

// TODO: Update types once everything is done
export class SupabaseIntegration {
  constructor(
    clientConstructor: SupabaseClient,
    options: {
      tracing?: boolean;
      errors?: boolean;
      breadcrumbs?: boolean;
    } = { tracing: true, errors: false, breadcrumbs = false },
  );
}
