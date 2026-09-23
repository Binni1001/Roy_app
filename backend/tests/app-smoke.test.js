import test from "node:test";
import assert from "node:assert/strict";

test("entire Express application imports with test configuration without external calls", async (t) => {
  process.env.SUPABASE_URL = "https://app-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-a-secret";
  process.env.PAYOS_CLIENT_ID = "test-client";
  process.env.PAYOS_API_KEY = "test-api-key";
  process.env.PAYOS_CHECKSUM_KEY = "test-checksum-key";
  t.mock.method(globalThis, "fetch", () => assert.fail("App bootstrap must not call an external service"));
  const { default: app } = await import("../src/app.js");
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});
