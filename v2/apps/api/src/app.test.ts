import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app.ts";
import { createTokenVerifier, userFromClaims } from "./auth.ts";
import { pickActiveGroup } from "./routes/bootstrap.ts";
import { ActionError } from "./routes/actions.ts";
import type { Debt } from "@roy/shared";
import { bearer, env, person, setup, stored, token, tournament } from "./testkit.ts";

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
  assert.deepEqual(await res.json(), { me: null, memberships: [], openPeriod: null, role: "user" });
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

test("arena history is asked only for the caller active group", async () => {
  const seen: string[] = [];
  const { get } = setup({ listLeaderboardSnapshots: async (groupId) => { seen.push(groupId); return []; } });
  const res = await get(await bearer(), "/me/arena/history");
  assert.equal(res.status, 200);
  assert.deepEqual(seen, ["g1"]);
});

test("saving a profile writes only the caller row and only the cleaned display fields", async () => {
  const writes: unknown[] = [];
  const { get } = setup();
  const app = setup({ updateProfile: async (id, input) => { writes.push([id, input]); return { ...input, email: null, avatarUrl: null }; } });
  const res = await app.put(await bearer(), "/me/profile", { fullName: " Minh  Anh ", nickname: "", phone: "0901 234 567", bio: null, status: "inactive" });
  assert.equal(res.status, 200);
  assert.deepEqual(writes, [["p1", { fullName: "Minh Anh", nickname: null, phone: "0901234567", bio: null }]]);
  assert.equal((await get(await bearer(), "/me/profile")).status, 200);
});

test("an invalid profile is rejected before anything is written", async () => {
  let written = 0;
  const app = setup({ updateProfile: async (_id, input) => { written++; return { ...input, email: null, avatarUrl: null }; } });
  const res = await app.put(await bearer(), "/me/profile", { fullName: "A" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "INVALID");
  assert.equal(written, 0);
});

test("creating a match puts the caller as challenger in the open period of their group", async () => {
  const inserted: unknown[] = [];
  const { post } = setup({ insertMatch: async (periodId, match) => void inserted.push([periodId, match.challengerId, match.opponentId, match.type]) });
  const res = await post(await bearer(), "/me/matches", { type: "singles", opponentId: "x", sets: 1, playDate: "2099-01-01" });
  assert.equal(res.status, 201);
  assert.deepEqual(inserted, [["k1", "p1", "x", "singles"]]);
});

test("a match against someone outside the group is rejected and nothing is inserted", async () => {
  let inserted = 0;
  const { post } = setup({ insertMatch: async () => void inserted++ });
  const res = await post(await bearer(), "/me/matches", { type: "singles", opponentId: "stranger", sets: 1, playDate: "2099-01-01" });
  assert.equal(res.status, 400);
  assert.equal(inserted, 0);
});

test("anyone in the match can accept it, and only a participant can act on a match", async () => {
  const mine = setup({ getMatch: async () => stored({ challengerIds: ["p1"], opponentIds: ["x"] }) });
  assert.equal((await mine.post(await bearer(), "/me/matches/m1/accept")).status, 200);
  const theirs = setup({ getMatch: async () => stored({ challengerIds: ["x"], opponentIds: ["y"] }) });
  assert.equal((await theirs.post(await bearer(), "/me/matches/m1/cancel")).status, 404);
  const otherGroup = setup({ getMatch: async () => stored({ groupId: "other" }) });
  assert.equal((await otherGroup.post(await bearer(), "/me/matches/m1/accept")).status, 404);
  assert.equal((await setup().post(await bearer(), "/me/matches/m1/accept")).status, 200);
});

test("a result is finalized through the database with the caller email and the derived winner", async () => {
  const calls: unknown[] = [];
  const { post } = setup({ finalizeMatch: async (id, winner, scores, email) => void calls.push([id, winner, scores.length, email]) });
  const res = await post(await bearer(), "/me/matches/m1/result", { setScores: [{ challenger: 21, opponent: 10 }, { challenger: 21, opponent: 12 }] });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [["m1", "challenger", 2, "a@b.c"]]);
});

test("a result cannot be recorded before the play date or for a finished match", async () => {
  let finalized = 0;
  const score = { setScores: [{ challenger: 21, opponent: 10 }] };
  const early = setup({ getMatch: async () => stored({ playDate: "2099-01-01" }), finalizeMatch: async () => void finalized++ });
  const tooEarly = await early.post(await bearer(), "/me/matches/m1/result", score);
  assert.equal(tooEarly.status, 409);
  assert.equal((await tooEarly.json()).code, "TOO_EARLY");
  const done = setup({ getMatch: async () => stored({ status: "completed" }), finalizeMatch: async () => void finalized++ });
  assert.equal((await done.post(await bearer(), "/me/matches/m1/result", score)).status, 409);
  assert.equal(finalized, 0);
});

test("a status change that lost a race is reported as a conflict", async () => {
  const { post } = setup({ setMatchStatus: async () => false });
  const res = await post(await bearer(), "/me/matches/m1/cancel");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "MATCH_CHANGED");
});

test("a failure to load the signing keys is a server error, not an invalid session", async () => {
  const app = createApp({
    verify: async () => {
      throw new TypeError("fetch failed");
    },
    store: {} as never,
    corsOrigins: [],
  });
  const res = await app.request("/bootstrap", { headers: { Authorization: "Bearer anything" } });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, "AUTH_UNAVAILABLE");
});
