import { test, afterEach } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { initSentry, initSupabase } from "./mocks.js";

import { SupabaseIntegration } from "../../v7.js";
import Supabase from "@supabase/supabase-js";

test("Errors", async (t) => {
  let integration;

  afterEach(() => {
    integration._restore();
    integration = undefined; // Makes sure that each test assigns its own instance
  });

  await t.test("Do not capture errors by default", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 }))
    );
    const { captureException } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient))
    );

    await supabase.from("mock-table").select("*").eq("id", 42);

    strictEqual(captureException.mock.calls.length, 0);
  });

  await t.test("Capture non-throwable errors if they are enabled", async () => {
    const e = "Invalid response";
    const supabase = initSupabase(() => new Response(e, { status: 404 }));
    const { captureException } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        errors: true,
      }))
    );

    await supabase.from("mock-table").select().eq("id", 42);
    await supabase.from("mock-table").insert({ id: 42 });
    await supabase.from("mock-table").upsert({ id: 42 }).select();
    await supabase.from("mock-table").update({ id: 1337 }).eq("id", 42);
    await supabase.from("mock-table").delete().eq("id", 42);

    strictEqual(captureException.mock.calls.length, 5);

    deepStrictEqual(captureException.mock.calls[0].arguments, [
      new Error(e),
      {
        contexts: {
          supabase: {
            query: ["select(*)", "eq(id, 42)"],
          },
        },
      },
    ]);
    deepStrictEqual(captureException.mock.calls[1].arguments, [
      new Error(e),
      {
        contexts: {
          supabase: {
            body: {
              id: 42,
            },
          },
        },
      },
    ]);
    deepStrictEqual(captureException.mock.calls[2].arguments, [
      new Error(e),
      {
        contexts: {
          supabase: {
            body: {
              id: 42,
            },
            query: ["select(*)"],
          },
        },
      },
    ]);
    deepStrictEqual(captureException.mock.calls[3].arguments, [
      new Error(e),
      {
        contexts: {
          supabase: {
            body: {
              id: 1337,
            },
            query: ["eq(id, 42)"],
          },
        },
      },
    ]);
    deepStrictEqual(captureException.mock.calls[4].arguments, [
      new Error(e),
      {
        contexts: {
          supabase: {
            query: ["eq(id, 42)"],
          },
        },
      },
    ]);
  });

  await t.test("Includes error details in captured errors", async () => {
    const err = "Invalid response";
    const supabase = initSupabase(
      () =>
        new Response(
          JSON.stringify({
            message: err,
            code: "PGRST116",
            details: "Something went wrong",
          }),
          { status: 500 }
        )
    );
    const { captureException } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        errors: true,
      }))
    );

    await supabase.from("mock-table").select().eq("id", 42);
    strictEqual(captureException.mock.calls.length, 1);

    const expectedErr = new Error("Invalid response");
    expectedErr.code = "PGRST116";
    expectedErr.details = "Something went wrong";
    deepStrictEqual(captureException.mock.calls[0].arguments, [
      expectedErr,
      {
        contexts: {
          supabase: {
            query: ["select(*)", "eq(id, 42)"],
          },
        },
      },
    ]);
  });

  await t.test(
    "Should be able to redact request body in errors context",
    async () => {
      const e = "Invalid response";
      const supabase = initSupabase(() => new Response(e, { status: 404 }));
      const { captureException } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
          errors: true,
          sanitizeBody(table, key, value) {
            switch (key) {
              case "password":
                return "<redacted>";
              case "token":
                return "<nope>";
              case "secret":
                return "<uwatm8>";
              default: {
                return value;
              }
            }
          },
        }))
      );

      await supabase
        .from("mock-table")
        .insert({ user: "picklerick", password: "whoops" });
      await supabase
        .from("mock-table")
        .upsert({ user: "picklerick", token: "whoops" });
      await supabase
        .from("mock-table")
        .update({ user: "picklerick", secret: "whoops" })
        .eq("id", 42);

      strictEqual(captureException.mock.calls.length, 3);

      {
        const arg = captureException.mock.calls[0].arguments[1];
        deepStrictEqual(arg.contexts.supabase.body, {
          user: "picklerick",
          password: "<redacted>",
        });
      }

      {
        const arg = captureException.mock.calls[1].arguments[1];
        deepStrictEqual(arg.contexts.supabase.body, {
          user: "picklerick",
          token: "<nope>",
        });
      }

      {
        const arg = captureException.mock.calls[2].arguments[1];
        deepStrictEqual(arg.contexts.supabase.body, {
          user: "picklerick",
          secret: "<uwatm8>",
        });
      }
    }
  );
});
