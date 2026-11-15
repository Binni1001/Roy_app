import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, person, setup, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

test("a fixed member sees saved availability and the fixed play dates, skipping Thursdays and open days", async () => {
  const res = await setup().get(await bearer(), "/me/availability");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.eligible, true);
  assert.equal(body.editable, true);
  assert.deepEqual(body.busyWeekdays, [3]);
  assert.deepEqual(body.dateOverrides, { "2026-11-14": "available" });
  assert.equal(body.revision, 2);
  // 10/11 thứ Ba; 11/11 là ngày tự đăng ký; 12/11 thứ Năm không chơi.
  assert.deepEqual(body.playDates.slice(0, 3), ["2026-11-10", "2026-11-13", "2026-11-14"]);
  assert.equal(body.playDates.at(-1), "2026-12-09");
});

test("a guest of the period or a management account cannot declare availability", async () => {
  const guest = await (await setup({ isFixedMember: async () => false }).get(await bearer(), "/me/availability")).json();
  assert.equal(guest.eligible, false);
  assert.match(guest.reason, /cố định/);
  const manager = await (await setup().get(await owner(), "/me/availability")).json();
  assert.equal(manager.eligible, false);
});

test("saving availability goes through the database with the caller, the open period and cleaned input", async () => {
  const calls: unknown[] = [];
  const { put } = setup({ savePreferences: async (...args) => void calls.push(args) });
  const res = await put(await bearer(), "/me/availability", {
    expectedRevision: 2,
    busyWeekdays: [6, 1, 6],
    dateOverrides: { "2026-11-20": "busy", "2026-11-13": "available" },
    personId: "someone-else",
  });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [
    ["k1", "p1", "user-1", { expectedRevision: 2, busyWeekdays: [1, 6], dateOverrides: { "2026-11-13": "available", "2026-11-20": "busy" } }],
  ]);
});

test("invalid availability is refused before reaching the database", async () => {
  let saved = 0;
  const { put } = setup({ savePreferences: async () => void saved++ });
  const bad = [
    { expectedRevision: -1, busyWeekdays: [], dateOverrides: {} },
    { expectedRevision: 0, busyWeekdays: [8], dateOverrides: {} },
    { expectedRevision: 0, busyWeekdays: [], dateOverrides: { "2027-01-01": "busy" } },
    { expectedRevision: 0, busyWeekdays: [], dateOverrides: { "2026-11-20": "maybe" } },
    { expectedRevision: 0, busyWeekdays: [], dateOverrides: { "2026-02-30": "busy" } },
  ];
  for (const body of bad) assert.equal((await put(await bearer(), "/me/availability", body)).status, 400);
  assert.equal(saved, 0);
});

test("only the owner lists and decides join requests, for the group they are viewing", async () => {
  const seen: string[] = [];
  const app = setup({
    listPendingMembers: async (groupId) => {
      seen.push(groupId);
      return [];
    },
  });
  assert.equal((await app.get(await bearer(), "/admin/pending-members")).status, 403);
  assert.equal((await app.post(await bearer(), "/admin/pending-members/p9/approve")).status, 403);
  assert.equal((await app.get(await owner(), "/admin/pending-members")).status, 200);
  assert.deepEqual(seen, ["g1"]);
  assert.equal((await app.get({}, "/admin/pending-members")).status, 401);
});

test("approving or rejecting changes only a pending request in the owner's group", async () => {
  const decided: string[] = [];
  const ok = setup({ decideMembership: async (personId, groupId, decision) => (decided.push(`${personId}:${groupId}:${decision}`), true) });
  assert.equal((await ok.post(await owner(), "/admin/pending-members/p9/approve")).status, 200);
  assert.equal((await ok.post(await owner(), "/admin/pending-members/p9/reject")).status, 200);
  assert.equal((await ok.post(await owner(), "/admin/pending-members/p9/delete")).status, 404);
  assert.deepEqual(decided, ["p9:g1:approve", "p9:g1:reject"]);

  const stranger = setup({ getMembershipStatus: async () => null, decideMembership: async () => (decided.push("x"), true) });
  assert.equal((await stranger.post(await owner(), "/admin/pending-members/p9/approve")).status, 404);
  const done = setup({ getMembershipStatus: async () => "active", decideMembership: async () => (decided.push("y"), true) });
  const again = await done.post(await owner(), "/admin/pending-members/p9/approve");
  assert.equal(again.status, 409);
  assert.equal((await again.json()).code, "REQUEST_DECIDED");
  const raced = setup({ decideMembership: async () => false });
  assert.equal((await raced.post(await owner(), "/admin/pending-members/p9/reject")).status, 409);
  assert.equal(decided.length, 2);
});

test("an owner without an active group cannot decide requests", async () => {
  const { get } = setup({ findPerson: async () => ({ ...person, person_groups: [] }) });
  assert.equal((await get(await owner(), "/admin/pending-members")).status, 403);
});

test("bootstrap reports the global role", async () => {
  assert.equal((await (await setup().get(await owner())).json()).role, "owner");
  assert.equal((await (await setup().get(await bearer())).json()).role, "user");
});
