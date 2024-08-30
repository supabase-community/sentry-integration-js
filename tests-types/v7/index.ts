import * as Sentry from "@sentry/node";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";

Sentry.init({
  dsn: "http://asd.com",
  integrations: [
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],
});
