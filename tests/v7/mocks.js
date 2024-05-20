import { createClient } from "@supabase/supabase-js";
import { mock } from "node:test";

export function initSupabase(responseFn) {
  return createClient("http://mock-url.com/1337", "anon", {
    global: {
      fetch: responseFn,
    },
  });
}

export function initSentry(integration) {
  const setHttpStatus = mock.fn();
  const finish = mock.fn();
  const startChild = mock.fn(() => {
    return {
      setHttpStatus,
      finish,
    };
  });
  const captureException = mock.fn();
  const addBreadcrumb = mock.fn();

  const getCurrentHub = () => ({
    addBreadcrumb,
    captureException,
    getScope: () => ({
      getTransaction: () => ({
        startChild,
      }),
    }),
  });

  // This is basically how Sentry's integrations setup works in v7.
  integration.setupOnce(() => {}, getCurrentHub);

  return { setHttpStatus, finish, startChild, captureException, addBreadcrumb };
}
