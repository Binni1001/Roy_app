import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import type { Debt } from "@roy/shared";
import { createApp } from "./app.ts";
import { createTokenVerifier, userFromClaims } from "./auth.ts";
import { pickActiveGroup, type PersonRow } from "./routes/bootstrap.ts";
import { ActionError, type ActionsStore } from "./routes/actions.ts";
import type { ArenaStore } from "./routes/arena.ts";
import type { ExtrasStore, TournamentData } from "./routes/extras.ts";
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

type Store = MemberStore & ArenaStore & ExtrasStore & ActionsStore;

const tournament = (groupId: string, status = "completed"): TournamentData => ({
  summary: { id: "t1", name: "Giai doi", status, startDate: null, endDate: null, championName: null },
  groupId,
  qualifiersPerGroup: 2,
  teams: [],
  groups: [],
  matches: [],
});

function setup(store: Partial<Store> = {}) {
  const periodCalls: string[] = [];
  const full: Store = {
    markNotificationsRead: async () => {},
    findOpenDay: async () => ({ periodId: "k1", date: "2026-11-20", groupId: "g1" }),
    mutateOpenDay: async () => {},
    listNotifications: async () => [],
    countUnreadNotifications: async () => 4,
    listTournaments: async () => [],
    getTournament: async () => tournament("g1"),
    getScoringRule: async () => "fixed_3_2_v1",
    listPeriodMatches: async () => [],
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
  const post = (headers: Record<string, string>, path: string) =>
    app.request(path, { method: "POST", headers });
  return { get, post, periodCalls };
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

test("notifications return the unread count with the latest items", async () => {
  const res = await setup().get(await bearer(), "/me/notifications");
  assert.deepEqual(await res.json(), { items: [], unread: 4 });
});

test("a tournament of the caller group is returned", async () => {
  const res = await setup().get(await bearer(), "/me/tournaments/t1");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).name, "Giai doi");
});

test("a tournament of another group, a draft, or a missing one is reported as not found", async () => {
  for (const getTournament of [async () => tournament("other"), async () => tournament("g1", "draft"), async () => null]) {
    const res = await setup({ getTournament }).get(await bearer(), "/me/tournaments/t1");
    assert.equal(res.status, 404);
  }
});

test("the tournament list is asked only for the caller active group", async () => {
  const seen: string[] = [];
  const { get } = setup({ listTournaments: async (groupId) => { seen.push(groupId); return []; } });
  await get(await bearer(), "/me/tournaments");
  assert.deepEqual(seen, ["g1"]);
});

test("marking notifications read touches only the caller", async () => {
  const seen: string[] = [];
  const { post } = setup({ markNotificationsRead: async (personId) => void seen.push(personId) });
  const res = await post(await bearer(), "/me/notifications/read");
  assert.equal(res.status, 200);
  assert.deepEqual(seen, ["p1"]);
});

test("joining an open day calls the database with the signed-in account and returns the schedule", async () => {
  const calls: string[] = [];
  const { post } = setup({
    mutateOpenDay: async (periodId, date, actorId, action) => void calls.push([periodId, date, actorId, action].join("|")),
  });
  const res = await post(await bearer(), "/me/open-days/d1/join");
  assert.equal(res.status, 200);
  assert.deepEqual(calls, ["k1|2026-11-20|user-1|join"]);
  assert.equal((await res.json()).period.id, "k1");
});

test("an open day of another group or an unknown action is not found and nothing is written", async () => {
  let written = 0;
  const other = setup({
    findOpenDay: async () => ({ periodId: "k9", date: "2026-11-20", groupId: "other" }),
    mutateOpenDay: async () => void written++,
  });
  assert.equal((await other.post(await bearer(), "/me/open-days/d1/join")).status, 404);
  const mine = setup({ mutateOpenDay: async () => void written++ });
  assert.equal((await mine.post(await bearer(), "/me/open-days/d1/open")).status, 404);
  assert.equal(written, 0);
});

test("a full day is reported with its own code", async () => {
  const { post } = setup({
    mutateOpenDay: async () => {
      throw new ActionError("full", 409, "OPEN_DAY_FULL");
    },
  });
  const res = await post(await bearer(), "/me/open-days/d1/join");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "OPEN_DAY_FULL");
});

test("write routes require a token", async () => {
  const { post } = setup();
  assert.equal((await post({}, "/me/open-days/d1/join")).status, 401);
  assert.equal((await post({}, "/me/notifications/read")).status, 401);
});
