import { test, afterEach } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { initSentry, initSupabase } from "./mocks.js";

import { SupabaseIntegration } from "../../v7.js";
import Supabase from "@supabase/supabase-js";

const COMMON_SPAN_PAYLOAD = {
  origin: "auto.db.supabase",
};
const COMMON_SPAN_DATA = {
  "db.schema": "public",
  "db.table": "mock-table",
  "db.url": "http://mock-url.com",
  "db.sdk": "supabase-js-node/2.39.7",
};

test("Tracing", async (t) => {
  let integration;

  afterEach(() => {
    integration._restore();
    integration = undefined; // Makes sure that each test assigns its own instance
  });

  await t.test(
    "Should capture spans for all operations with default configuration",
    async () => {
      const supabase = initSupabase(
        () => new Response(JSON.stringify({ id: 42 }))
      );
      const { setHttpStatus, finish, startChild } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient))
      );

      await supabase
        .from("mock-table")
        .select()
        .lt("id", 42)
        .gt("id", 20)
        .not("id", "eq", 32);
      await supabase.from("mock-table").insert({ id: 42 });
      await supabase.from("mock-table").upsert({ id: 42 }).select("id,name");
      await supabase
        .from("mock-table")
        .update({ id: 1337 })
        .eq("id", 42)
        .or("id.eq.8")
        .or("id.eq.42", { referencedTable: "foo" });
      await supabase.from("mock-table").delete().eq("id", 42);
      strictEqual(startChild.mock.calls.length, 5);
      strictEqual(setHttpStatus.mock.calls.length, 5);
      strictEqual(finish.mock.calls.length, 5);

      deepStrictEqual(startChild.mock.calls[0].arguments[0], {
        ...COMMON_SPAN_PAYLOAD,
        data: {
          ...COMMON_SPAN_DATA,
          "db.query": [
            "select(*)",
            "lt(id, 42)",
            "gt(id, 20)",
            "not(id, eq.32)",
          ],
        },
        description: "from(mock-table)",
        op: "db.select",
      });

      deepStrictEqual(startChild.mock.calls[1].arguments[0], {
        ...COMMON_SPAN_PAYLOAD,
        data: {
          ...COMMON_SPAN_DATA,
          "db.body": {
            id: 42,
          },
        },
        description: "from(mock-table)",
        op: "db.insert",
      });

      deepStrictEqual(startChild.mock.calls[2].arguments[0], {
        ...COMMON_SPAN_PAYLOAD,
        data: {
          ...COMMON_SPAN_DATA,
          "db.body": {
            id: 42,
          },
          "db.query": ["select(id,name)"],
        },
        description: "from(mock-table)",
        op: "db.upsert",
      });

      deepStrictEqual(startChild.mock.calls[3].arguments[0], {
        ...COMMON_SPAN_PAYLOAD,
        data: {
          ...COMMON_SPAN_DATA,
          "db.query": ["eq(id, 42)", "or(id.eq.8)", "foo.or(id.eq.42)"],
          "db.body": {
            id: 1337,
          },
        },
        description: "from(mock-table)",
        op: "db.update",
      });

      deepStrictEqual(startChild.mock.calls[4].arguments[0], {
        ...COMMON_SPAN_PAYLOAD,
        data: {
          ...COMMON_SPAN_DATA,
          "db.query": ["eq(id, 42)"],
        },
        description: "from(mock-table)",
        op: "db.delete",
      });

      deepStrictEqual(
        setHttpStatus.mock.calls.map((c) => c.arguments),
        [[200], [200], [200], [200], [200]]
      );

      deepStrictEqual(
        finish.mock.calls.map((c) => c.arguments),
        [[], [], [], [], []]
      );
    }
  );

  await t.test("Should not capture spans if tracing is disabled", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 }))
    );
    const { startChild, setHttpStatus, finish } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        tracing: false,
      }))
    );

    await supabase.from("mock-table").select("*").eq("id", 42);

    strictEqual(startChild.mock.calls.length, 0);
    strictEqual(setHttpStatus.mock.calls.length, 0);
    strictEqual(finish.mock.calls.length, 0);
  });

  await t.test(
    "Should set correct span status based on response status",
    async () => {
      const supabase = initSupabase(
        () => new Response(JSON.stringify("Invalid response"), { status: 404 })
      );
      const { setHttpStatus, finish, startChild } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient))
      );

      await supabase.from("mock-table").select("*").eq("id", 42);
      await supabase.from("mock-table").delete().eq("id", 42);

      strictEqual(startChild.mock.calls.length, 2);
      strictEqual(setHttpStatus.mock.calls.length, 2);
      strictEqual(finish.mock.calls.length, 2);

      deepStrictEqual(setHttpStatus.mock.calls[0].arguments, [404]);
      deepStrictEqual(setHttpStatus.mock.calls[1].arguments, [404]);
    }
  );

  await t.test("Should be able to filter spans", async () => {
    const supabase = initSupabase(
      () => new Response(JSON.stringify({ id: 42 }))
    );
    const { setHttpStatus, finish, startChild } = initSentry(
      (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
        shouldCreateSpan(builder) {
          strictEqual(builder.method, "GET");
          strictEqual(builder.url.origin, "http://mock-url.com");
          if (builder.url.searchParams.get("id") === "eq.42") {
            return false;
          }
          return true;
        },
      }))
    );

    await supabase.from("mock-table").select("*").eq("id", 42);
    await supabase.from("mock-table").select("*").eq("id", 1337);

    strictEqual(startChild.mock.calls.length, 1);
    strictEqual(setHttpStatus.mock.calls.length, 1);
    strictEqual(finish.mock.calls.length, 1);

    const arg = startChild.mock.calls[0].arguments[0];
    deepStrictEqual(arg.data["db.query"], ["select(*)", "eq(id, 1337)"]);
  });

  await t.test(
    "Should be able to redact request body in spans data",
    async () => {
      const supabase = initSupabase(
        () => new Response(JSON.stringify({ id: 42 }))
      );
      const { setHttpStatus, finish, startChild } = initSentry(
        (integration = new SupabaseIntegration(Supabase.SupabaseClient, {
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

      strictEqual(startChild.mock.calls.length, 3);
      strictEqual(setHttpStatus.mock.calls.length, 3);
      strictEqual(finish.mock.calls.length, 3);

      {
        const arg = startChild.mock.calls[0].arguments[0];
        deepStrictEqual(arg.data["db.body"], {
          user: "picklerick",
          password: "<redacted>",
        });
      }

      {
        const arg = startChild.mock.calls[1].arguments[0];
        deepStrictEqual(arg.data["db.body"], {
          user: "picklerick",
          token: "<nope>",
        });
      }

      {
        const arg = startChild.mock.calls[2].arguments[0];
        deepStrictEqual(arg.data["db.body"], {
          user: "picklerick",
          secret: "<uwatm8>",
        });
      }
    }
  );
});
