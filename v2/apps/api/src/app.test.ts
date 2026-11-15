import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import type { Debt } from "@roy/shared";
import { createApp } from "./app.ts";
import { createTokenVerifier, userFromClaims } from "./auth.ts";
import { pickActiveGroup, type PersonRow } from "./routes/bootstrap.ts";
import type { MemberStore } from "./routes/member.ts";

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

async function bearer(email = "a@b.c") {
  return { Authorization: `Bearer ${await token({ email })}` };
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

const debt = (id: string, status: Debt["status"], amount: number): Debt => ({
  id,
  status,
  amount,
  type: "monthly_fee",
  description: null,
  periodName: "Mua 6",
  createdAt: "2026-11-10",
  paidAt: null,
});

function setup(store: Partial<MemberStore> = {}) {
  const periodCalls: string[] = [];
  const full: MemberStore = {
    findPerson: async () => person,
    findOpenPeriod: async (groupId) => {
      periodCalls.push(groupId);
      return { id: "k1", name: "Mua 6", status: "open", startDate: "2026-11-10", endDate: "2026-12-09" };
    },
    listDebts: async () => [
      debt("d1", "unpaid", 150000),
      debt("d2", "paid", 90000),
      debt("d3", "unpaid", 35000),
      debt("d4", "cancelled", 500),
    ],
    getBalance: async () => 20000,
    listTransactions: async () => [],
    listOpenLoans: async () => [],
    listOpenDays: async () => [],
    listPlayedSessions: async () => [],
    ...store,
  };
  const app = createApp({
    verify: createTokenVerifier(env),
    store: full,
    corsOrigins: ["http://localhost:5174"],
  });
  const get = (headers: Record<string, string> = {}, path = "/bootstrap") =>
    app.request(path, { headers });
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
  const res = await get(await bearer("A@B.c"));
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
  const res = await get(await bearer("new@b.c"));
  assert.deepEqual(await res.json(), { me: null, memberships: [], openPeriod: null });
});

test("bootstrap blocks an inactive account", async () => {
  const { get } = setup({ findPerson: async () => ({ ...person, status: "inactive" }) });
  const res = await get(await bearer());
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

test("wallet totals only unpaid debts and separates settled ones", async () => {
  const res = await setup().get(await bearer(), "/me/wallet");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.unpaidTotal, 185000);
  assert.deepEqual(body.unpaidDebts.map((d: Debt) => d.id), ["d1", "d3"]);
  assert.deepEqual(body.settledDebts.map((d: Debt) => d.id), ["d2"]);
  assert.equal(body.balance, 20000);
});

test("wallet is scoped to the caller and their active group", async () => {
  const seen: string[] = [];
  const { get } = setup({
    listDebts: async (personId, groupId) => {
      seen.push(`${personId}:${groupId}`);
      return [];
    },
  });
  await get(await bearer(), "/me/wallet");
  assert.deepEqual(seen, ["p1:g1"]);
});

test("member routes refuse a caller without an active group", async () => {
  const { get } = setup({ findPerson: async () => ({ ...person, person_groups: [] }) });
  const res = await get(await bearer(), "/me/schedule");
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, "NO_GROUP");
});

test("member routes require a token", async () => {
  assert.equal((await setup().get({}, "/me/wallet")).status, 401);
});

test("schedule is empty when the group has no open period", async () => {
  const { get } = setup({ findOpenPeriod: async () => null });
  const res = await get(await bearer(), "/me/schedule");
  assert.deepEqual(await res.json(), { period: null, openDays: [], playedSessions: [] });
});
