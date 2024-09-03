import { createClient } from "@supabase/supabase-js";
import { mock } from "node:test";

export function initSupabase(responseFn) {
  return createClient("http://mock-url.com/1337", "anon", {
    global: {
      fetch: responseFn,
    },
  });
}

export function getSentryMock() {
  const setAttribute = mock.fn();
  const setStatus = mock.fn();
  const end = mock.fn();
  const startInactiveSpan = mock.fn(() => {
    return {
      setAttribute,
      setStatus,
      end,
    };
  });
  const captureException = mock.fn();
  const addBreadcrumb = mock.fn();

  return {
    setAttribute,
    setStatus,
    end,
    startInactiveSpan,
    captureException,
    addBreadcrumb,
    SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN: "origin",
    SEMANTIC_ATTRIBUTE_SENTRY_OP: "op",
  };
}
