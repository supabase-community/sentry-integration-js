import { test, afterEach } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { initSentry, initSupabase } from "./mocks.js";

import { SupabaseIntegration } from "../index.js";
import Supabase from "@supabase/supabase-js";

const COMMON_BREADCRUMB_PAYLOAD = {
  type: "supabase",
  message: "from(mock-table)",
};

test("Breadcrumbs", async (t) => {
  let integration;

  afterEach(() => {
    integration._restore();
    integration = undefined; // Makes sure that each test assigns its own instance
  });

  await t.test("Should capture breadcrumbs by default", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 }))
    );
    const { addBreadcrumb } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient))
    );

    await supabase.from("mock-table").select().eq("id", 42);
    await supabase.from("mock-table").insert({ id: 42 });
    await supabase.from("mock-table").upsert({ id: 42 }).select();
    await supabase.from("mock-table").update({ id: 1337 }).eq("id", 42);
    await supabase.from("mock-table").delete().eq("id", 42);

    strictEqual(addBreadcrumb.mock.calls.length, 5);

    deepStrictEqual(addBreadcrumb.mock.calls[0].arguments[0], {
      ...COMMON_BREADCRUMB_PAYLOAD,
      category: "db.select",
      data: {
        query: ["select(*)", "eq(id, 42)"],
      },
    });

    deepStrictEqual(addBreadcrumb.mock.calls[1].arguments[0], {
      ...COMMON_BREADCRUMB_PAYLOAD,
      category: "db.insert",
      data: {
        body: {
          id: 42,
        },
      },
    });

    deepStrictEqual(addBreadcrumb.mock.calls[2].arguments[0], {
      ...COMMON_BREADCRUMB_PAYLOAD,
      category: "db.upsert",
      data: {
        query: ["select(*)"],
        body: {
          id: 42,
        },
      },
    });

    deepStrictEqual(addBreadcrumb.mock.calls[3].arguments[0], {
      ...COMMON_BREADCRUMB_PAYLOAD,
      category: "db.update",
      data: {
        query: ["eq(id, 42)"],
        body: {
          id: 1337,
        },
      },
    });

    deepStrictEqual(addBreadcrumb.mock.calls[4].arguments[0], {
      ...COMMON_BREADCRUMB_PAYLOAD,
      category: "db.delete",
      data: {
        query: ["eq(id, 42)"],
      },
    });
  });

  await t.test(
    "Should not capture breadcrumbs if breadcrumbs are disabled",
    async () => {
      const supabase = initSupabase(
        () => new Response(JSON.stringify({ id: 42 }))
      );
      const { addBreadcrumb } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
          breadcrumbs: false,
        }))
      );

      await supabase.from("mock-table").select("*").eq("id", 42);

      strictEqual(addBreadcrumb.mock.calls.length, 0);
    }
  );

  await t.test(
    "Should be able to redact request body in breadcrumbs",
    async () => {
      const supabase = initSupabase(
        () => new Response(JSON.stringify({ id: 42 }))
      );
      const { addBreadcrumb } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
          breadcrumbs: true,
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

      strictEqual(addBreadcrumb.mock.calls.length, 3);

      {
        const arg = addBreadcrumb.mock.calls[0].arguments[0];
        deepStrictEqual(arg.data.body, {
          user: "picklerick",
          password: "<redacted>",
        });
      }

      {
        const arg = addBreadcrumb.mock.calls[1].arguments[0];
        deepStrictEqual(arg.data.body, {
          user: "picklerick",
          token: "<nope>",
        });
      }

      {
        const arg = addBreadcrumb.mock.calls[2].arguments[0];
        deepStrictEqual(arg.data.body, {
          user: "picklerick",
          secret: "<uwatm8>",
        });
      }
    }
  );
});
