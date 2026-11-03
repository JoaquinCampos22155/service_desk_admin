import assert from "node:assert/strict";
import test from "node:test";

const modulePath = "../src/supabase-client.mjs";
const clientModule = await import(modulePath).catch(() => ({}));

test("missing public Supabase config fails with a setup message", () => {
  assert.equal(typeof clientModule.createSupabaseClient, "function");
  assert.throws(
    () => clientModule.createSupabaseClient({}, () => ({})),
    (error) => error.name === "SupabaseConfigError" && /VITE_SUPABASE_URL/.test(error.message),
  );
});

test("valid public Supabase config creates one client", () => {
  assert.equal(typeof clientModule.createSupabaseClient, "function");
  const expectedClient = {};
  const calls = [];
  const client = clientModule.createSupabaseClient({
    VITE_SUPABASE_URL: "https://project.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  }, (...args) => {
    calls.push(args);
    return expectedClient;
  });

  assert.equal(client, expectedClient);
  assert.deepEqual(calls, [["https://project.supabase.co", "sb_publishable_test"]]);
});
