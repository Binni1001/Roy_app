import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { createApp } from "./app.ts";
import { createTokenVerifier, userFromClaims } from "./auth.ts";
import { pickActiveGroup, type BootstrapStore, type PersonRow } from "./routes/bootstrap.ts";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_JWT_SECRET: "test-secret-test-secret-test-secret",
};
const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

function token(claims: Record<string, unknown>, key = secret) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setIssuer("https://example.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setExpirationTime("5m")
    .sign(key);
}

const person: PersonRow = {
  id: "p1",
  full_name: "Minh",
  nickname: null,
  avatar_url: null,
  status: "active",
  active_group_id: "g2",
  person_groups: [
    { group_id: "g1", status: "active", member_role: "member", groups: { id: "g1", name: "Roy" } },
    { group_id: "g2", status: "pending", member_role: "member", groups: { id: "g2", name: "Khac" } },
  ],
};

function setup(store: Partial<BootstrapStore> = {}) {
  const periodCalls: string[] = [];
  const full: BootstrapStore = {
    findPerson: async () => person,
    findOpenPeriod: async (groupId) => {
      periodCalls.push(groupId);
      return { id: "k1", name: "Mua 6", status: "open", startDate: "2026-11-10", endDate: "2026-12-09" };
    },
    ...store,
  };
  const app = createApp({
    verify: createTokenVerifier(env),
    store: full,
    corsOrigins: ["http://localhost:5174"],
  });
  const get = (headers: Record<string, string> = {}) => app.request("/bootstrap", { headers });
  return { get, periodCalls };
}

test("bootstrap rejects a missing token", async () => {
  assert.equal((await setup().get()).status, 401);
});

test("bootstrap rejects a token signed with another key", async () => {
  const other = new TextEncoder().encode("another-secret-another-secret-xx");
  const forged = await token({ email: "a@b.c" }, other);
  assert.equal((await setup().get({ Authorization: `Bearer ${forged}` })).status, 401);
});

test("bootstrap returns person, memberships and the open period of an active group", async () => {
  const { get, periodCalls } = setup();
  const res = await get({ Authorization: `Bearer ${await token({ email: "A@B.c" })}` });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.me.fullName, "Minh");
  assert.equal(body.memberships.length, 2);
  // g2 is the stored preference but still pending, so the active membership g1 is used.
  assert.equal(body.me.activeGroupId, "g1");
  assert.deepEqual(periodCalls, ["g1"]);
  assert.equal(body.openPeriod.name, "Mua 6");
});

test("bootstrap reports a signed-in account without a player profile", async () => {
  const { get } = setup({ findPerson: async () => null });
  const res = await get({ Authorization: `Bearer ${await token({ email: "new@b.c" })}` });
  assert.deepEqual(await res.json(), { me: null, memberships: [], openPeriod: null });
});

test("bootstrap blocks an inactive account", async () => {
  const { get } = setup({ findPerson: async () => ({ ...person, status: "inactive" }) });
  const res = await get({ Authorization: `Bearer ${await token({ email: "a@b.c" })}` });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, "ACCOUNT_INACTIVE");
});

test("user_metadata never grants a role", () => {
  const user = userFromClaims({ sub: "u", email: "a@b.c", user_metadata: { role: "owner" } });
  assert.equal(user?.role, "user");
});

test("pickActiveGroup returns null without an active membership", () => {
  const pending = [{ groupId: "g2", groupName: "x", role: "member" as const, status: "pending" as const }];
  assert.equal(pickActiveGroup("g2", pending), null);
});
