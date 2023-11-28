import { test, afterEach } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { initSentry, initSupabase } from "./mocks.js";

import { SupabaseIntegration } from "../index.js";
import Supabase from "@supabase/supabase-js";

test("Instrumentation", async (t) => {
  let integration;

  afterEach(() => {
    integration._restore();
    integration = undefined; // Makes sure that each test assigns its own instance
  });

  await t.test("Should preserve returned data", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 })),
    );

    initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        tracing: true,
        breadcrumbs: true,
        errors: true,
      })),
    );

    var { data, error } = await supabase
      .from("mock-table")
      .select()
      .eq("id", 42);
    deepStrictEqual(data, { id: 42 });
    deepStrictEqual(error, null);

    var { data, error } = await supabase.from("mock-table").insert({ id: 42 });
    deepStrictEqual(data, { id: 42 });
    deepStrictEqual(error, null);

    var { data, error } = await supabase
      .from("mock-table")
      .upsert({ id: 42 })
      .select();
    deepStrictEqual(data, { id: 42 });
    deepStrictEqual(error, null);

    var { data, error } = await supabase
      .from("mock-table")
      .update({ id: 1337 })
      .eq("id", 42);
    deepStrictEqual(data, { id: 42 });
    deepStrictEqual(error, null);

    var { data, error } = await supabase
      .from("mock-table")
      .delete()
      .eq("id", 42);
    deepStrictEqual(data, { id: 42 });
    deepStrictEqual(error, null);
  });

  await t.test("Should preserve returned errors", async () => {
    const supabase = initSupabase(
      () => new Response("Invalid request", { status: 500 }),
    );

    initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        tracing: true,
        breadcrumbs: true,
        errors: true,
      })),
    );

    var { data, error } = await supabase
      .from("mock-table")
      .select()
      .eq("id", 42);
    deepStrictEqual(data, null);
    deepStrictEqual(error, { message: "Invalid request" });

    var { data, error } = await supabase.from("mock-table").insert({ id: 42 });
    deepStrictEqual(data, null);
    deepStrictEqual(error, { message: "Invalid request" });

    var { data, error } = await supabase
      .from("mock-table")
      .upsert({ id: 42 })
      .select();
    deepStrictEqual(data, null);
    deepStrictEqual(error, { message: "Invalid request" });

    var { data, error } = await supabase
      .from("mock-table")
      .update({ id: 1337 })
      .eq("id", 42);
    deepStrictEqual(data, null);
    deepStrictEqual(error, { message: "Invalid request" });

    var { data, error } = await supabase
      .from("mock-table")
      .delete()
      .eq("id", 42);
    deepStrictEqual(data, null);
    deepStrictEqual(error, { message: "Invalid request" });
  });

  await t.test(
    "Should be able to not instrumentation specific operations",
    async () => {
      const supabase = initSupabase(
        () => new Response("Invalid request", { status: 500 }),
      );
      const {
        setHttpStatus,
        finish,
        startChild,
        addBreadcrumb,
        captureException,
      } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
          tracing: true,
          breadcrumbs: true,
          errors: true,
          operations: ["select", "delete"],
        })),
      );

      await supabase.from("mock-table").select().eq("id", 42);
      await supabase.from("mock-table").insert({ id: 42 });
      await supabase.from("mock-table").upsert({ id: 42 }).select();
      await supabase.from("mock-table").update({ id: 1337 }).eq("id", 42);
      await supabase.from("mock-table").delete().eq("id", 42);

      strictEqual(startChild.mock.calls.length, 2);
      strictEqual(setHttpStatus.mock.calls.length, 2);
      strictEqual(finish.mock.calls.length, 2);
      strictEqual(addBreadcrumb.mock.calls.length, 2);
      strictEqual(captureException.mock.calls.length, 2);
    },
  );
});
