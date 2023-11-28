import { test, afterEach } from "node:test";
import { ok, strictEqual } from "node:assert";
import { initSentry, initSupabase } from "./mocks.js";

import { SupabaseIntegration } from "../index.js";
import Supabase from "@supabase/supabase-js";

test("Errors", async (t) => {
  let integration;

  afterEach(() => {
    integration._restore();
    integration = undefined; // Makes sure that each test assigns its own instance
  });

  await t.test("Do not capture errors by default", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 })),
    );
    const { captureException } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient)),
    );

    await supabase.from("mock-table").select("*").eq("id", 42);

    strictEqual(captureException.mock.calls.length, 0);
  });

  await t.test("Capture non-throwable errors if they are enabled", async () => {
    const err = "Invalid response";
    const supabase = initSupabase(() => new Response(err, { status: 404 }));
    const { captureException } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        errors: true,
      })),
    );

    await supabase.from("mock-table").select().eq("id", 42);
    await supabase.from("mock-table").insert({ id: 42 });
    await supabase.from("mock-table").upsert({ id: 42 }).select();
    await supabase.from("mock-table").update({ id: 1337 }).eq("id", 42);
    await supabase.from("mock-table").delete().eq("id", 42);

    strictEqual(captureException.mock.calls.length, 5);

    ok(captureException.mock.calls[0].arguments[0] instanceof Error);
    strictEqual(captureException.mock.calls[0].arguments[0].message, err);

    ok(captureException.mock.calls[1].arguments[0] instanceof Error);
    strictEqual(captureException.mock.calls[1].arguments[0].message, err);

    ok(captureException.mock.calls[2].arguments[0] instanceof Error);
    strictEqual(captureException.mock.calls[2].arguments[0].message, err);

    ok(captureException.mock.calls[3].arguments[0] instanceof Error);
    strictEqual(captureException.mock.calls[3].arguments[0].message, err);

    ok(captureException.mock.calls[4].arguments[0] instanceof Error);
    strictEqual(captureException.mock.calls[4].arguments[0].message, err);
  });
});
