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

  await t.test("Should not capture breadcrumbs by default", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 })),
    );
    const { addBreadcrumb } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient)),
    );

    await supabase.from("mock-table").select("*").eq("id", 42);

    strictEqual(addBreadcrumb.mock.calls.length, 0);
  });

  await t.test("Should capture breadcrumbs if they are enabled", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 })),
    );
    const { addBreadcrumb } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        breadcrumbs: true,
      })),
    );

    await supabase.from("mock-table").select().eq("id", 42);
    await supabase.from("mock-table").insert({ id: 42 });
    await supabase.from("mock-table").upsert({ id: 42 }).select();
    await supabase.from("mock-table").update({ id: 1337 }).eq("id", 42);
    await supabase.from("mock-table").delete().eq("id", 42);

    strictEqual(addBreadcrumb.mock.calls.length, 5);

    deepStrictEqual(addBreadcrumb.mock.calls[0].arguments, [
      {
        ...COMMON_BREADCRUMB_PAYLOAD,
        category: "db.select",
        data: {
          query: {
            select: "*",
            id: "eq.42",
          },
        },
      },
    ]);

    deepStrictEqual(addBreadcrumb.mock.calls[1].arguments, [
      {
        ...COMMON_BREADCRUMB_PAYLOAD,
        category: "db.insert",
        data: {
          body: {
            id: 42,
          },
        },
      },
    ]);

    deepStrictEqual(addBreadcrumb.mock.calls[2].arguments, [
      {
        ...COMMON_BREADCRUMB_PAYLOAD,
        category: "db.upsert",
        data: {
          query: {
            select: "*",
          },
          body: {
            id: 42,
          },
        },
      },
    ]);

    deepStrictEqual(addBreadcrumb.mock.calls[3].arguments, [
      {
        ...COMMON_BREADCRUMB_PAYLOAD,
        category: "db.update",
        data: {
          query: {
            id: "eq.42",
          },
          body: {
            id: 1337,
          },
        },
      },
    ]);

    deepStrictEqual(addBreadcrumb.mock.calls[4].arguments, [
      {
        ...COMMON_BREADCRUMB_PAYLOAD,
        category: "db.delete",
        data: {
          query: {
            id: "eq.42",
          },
        },
      },
    ]);
  });
});
