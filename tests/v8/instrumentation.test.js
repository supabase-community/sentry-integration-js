import { test, afterEach } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { getSentryMock, initSupabase } from "./mocks.js";

import { supabaseIntegration } from "../../v8.js";
import Supabase from "@supabase/supabase-js";

test("Instrumentation", async (t) => {
  let integration;

  afterEach(() => {
    integration._restore();
    integration = undefined; // Makes sure that each test assigns its own instance
  });

  await t.test(
    "Should work directly with the SupabaseClient constructor",
    async () => {
      const supabase = initSupabase(
        () => new Response(JSON.stringify({ id: 42 }))
      );

      const Sentry = getSentryMock();
      integration = supabaseIntegration(Supabase.SupabaseClient, Sentry, {
        tracing: true,
        breadcrumbs: true,
        errors: true,
      });
      // This is basically how Sentry's integrations setup works in v8.
      integration.setupOnce(() => {});

      await supabase.from("mock-table").select().eq("id", 42);

      strictEqual(Sentry.startInactiveSpan.mock.calls.length, 1);
    }
  );

  await t.test("Should work with the SupabaseClient instance", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 }))
    );

    const Sentry = getSentryMock();
    integration = supabaseIntegration(supabase, Sentry, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    });
    integration.setupOnce(() => {});

    await supabase.from("mock-table").select().eq("id", 42);

    strictEqual(Sentry.startInactiveSpan.mock.calls.length, 1);
  });

  await t.test("Should preserve returned data", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 }))
    );

    const Sentry = getSentryMock();
    integration = supabaseIntegration(Supabase.SupabaseClient, Sentry, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    });
    integration.setupOnce(() => {});

    {
      const { data, error } = await supabase
        .from("mock-table")
        .select()
        .eq("id", 42);
      deepStrictEqual(data, { id: 42 });
      deepStrictEqual(error, null);
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .insert({ id: 42 });
      deepStrictEqual(data, { id: 42 });
      deepStrictEqual(error, null);
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .upsert({ id: 42 })
        .select();
      deepStrictEqual(data, { id: 42 });
      deepStrictEqual(error, null);
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .update({ id: 1337 })
        .eq("id", 42);
      deepStrictEqual(data, { id: 42 });
      deepStrictEqual(error, null);
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .delete()
        .eq("id", 42);
      deepStrictEqual(data, { id: 42 });
      deepStrictEqual(error, null);
    }
  });

  await t.test("Should preserve returned errors", async () => {
    const supabase = initSupabase(
      () => new Response("Invalid request", { status: 500 })
    );

    const Sentry = getSentryMock();
    integration = supabaseIntegration(Supabase.SupabaseClient, Sentry, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    });
    integration.setupOnce(() => {});

    {
      const { data, error } = await supabase
        .from("mock-table")
        .select()
        .eq("id", 42);
      deepStrictEqual(data, null);
      deepStrictEqual(error, { message: "Invalid request" });
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .insert({ id: 42 });
      deepStrictEqual(data, null);
      deepStrictEqual(error, { message: "Invalid request" });
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .upsert({ id: 42 })
        .select();
      deepStrictEqual(data, null);
      deepStrictEqual(error, { message: "Invalid request" });
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .update({ id: 1337 })
        .eq("id", 42);
      deepStrictEqual(data, null);
      deepStrictEqual(error, { message: "Invalid request" });
    }

    {
      const { data, error } = await supabase
        .from("mock-table")
        .delete()
        .eq("id", 42);
      deepStrictEqual(data, null);
      deepStrictEqual(error, { message: "Invalid request" });
    }
  });

  await t.test(
    "Should be able to not instrument specific operations",
    async () => {
      const supabase = initSupabase(
        () => new Response("Invalid request", { status: 500 })
      );

      const Sentry = getSentryMock();
      integration = supabaseIntegration(Supabase.SupabaseClient, Sentry, {
        tracing: true,
        breadcrumbs: true,
        errors: true,
        operations: ["select", "delete"],
      });
      integration.setupOnce(() => {});

      await supabase.from("mock-table").select().eq("id", 42);
      await supabase.from("mock-table").insert({ id: 42 });
      await supabase.from("mock-table").upsert({ id: 42 }).select();
      await supabase.from("mock-table").update({ id: 1337 }).eq("id", 42);
      await supabase.from("mock-table").delete().eq("id", 42);

      strictEqual(Sentry.startInactiveSpan.mock.calls.length, 2);
      strictEqual(Sentry.setAttribute.mock.calls.length, 2);
      strictEqual(Sentry.setStatus.mock.calls.length, 2);
      strictEqual(Sentry.end.mock.calls.length, 2);
      strictEqual(Sentry.addBreadcrumb.mock.calls.length, 2);
      strictEqual(Sentry.captureException.mock.calls.length, 2);
    }
  );
});
