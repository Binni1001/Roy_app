import test from "node:test";
import assert from "node:assert/strict";
import { SCHEDULE_RULES, analyzeWeek, defaultWeek, isAvailable, isDate, validatePreferences } from "../src/modules/session-planning/sessionPlanning.rules.js";

process.env.SUPABASE_URL = "https://planning-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-a-secret";
const { createSessionPlanningService, checkPlanningResult } = await import("../src/modules/session-planning/sessionPlanning.service.js");
const { groupAccess } = await import("../src/services/groupAccess.js");
const { adminScopeRollout } = await import("../src/middleware/adminScopeRollout.js");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const Q = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const U = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const V = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const owner = { id: U, app_metadata: { role: "owner" } };
const admin = { id: U, app_metadata: { role: "admin", managed_group_ids: [A] } };
const user = { id: U, email: "a@example.test", app_metadata: { role: "user" } };
const period = { id: P, group_id: A, name: "Test", start_date: "2026-09-01", end_date: "2026-09-30", status: "open" };
const payload = { expected_revision: 0, busy_weekdays: [], date_overrides: {} };
const members = (n) => Array.from({ length: n }, (_, index) => ({ id: `person-${index}` }));

test("agreed configuration is 8 seats, six days, four fixed sessions and no parity restriction", () => {
  assert.equal(SCHEDULE_RULES.capacity, 8);
  assert.deepEqual(SCHEDULE_RULES.playing_weekdays, [1, 2, 3, 5, 6, 7]);
  assert.equal(SCHEDULE_RULES.fixed_sessions_per_week, 4);
  assert.equal(SCHEDULE_RULES.parity_restriction, false);
  assert.equal(SCHEDULE_RULES.guest_priority, "fixed_first");
});

test("full weeks calculate exact 11/12/13 member capacity without changing quotas", () => {
  const a = analyzeWeek(period, members(11), [], "2026-09-07");
  assert.equal(a.required_slots, 44); assert.equal(a.capacity_slots, 48);
  assert.equal(a.extra_slots, 4); assert.equal(a.possible, true);
  const b = analyzeWeek(period, members(12), [], "2026-09-07");
  assert.equal(b.extra_slots, 0); assert.equal(b.possible, true);
  const c = analyzeWeek(period, members(13), [], "2026-09-07");
  assert.equal(c.shortfall, 4); assert.equal(c.possible, false);
});

test("exact check catches concentrated availability even with enough aggregate slots", () => {
  const people = members(9);
  // Each has four free days, but the same four days only hold 32 of 36 required visits.
  const prefs = people.map((person) => ({ person_id: person.id, busy_weekdays: [6, 7] }));
  const result = analyzeWeek(period, people, prefs, "2026-09-07");
  assert.equal(result.capacity_slots, 48); assert.equal(result.required_slots, 36);
  assert.equal(result.shortfall, 4); assert.equal(result.possible, false);
  assert.ok(result.availability.every((row) => row.available_dates.length === 4));
});

test("date overrides take precedence without opening Thursday, default remains available", () => {
  assert.equal(isAvailable("2026-09-07", {}), true);
  const prefs = { busy_weekdays: [1], date_overrides: { "2026-09-07": "available", "2026-09-08": "busy", "2026-09-10": "available" } };
  assert.equal(isAvailable("2026-09-07", prefs), true);
  assert.equal(isAvailable("2026-09-14", prefs), false);
  assert.equal(isAvailable("2026-09-08", prefs), false);
  assert.equal(isAvailable("2026-09-10", prefs), false);
});

test("partial weeks do not invent sessions outside period or silently prorate four-session target", () => {
  const result = analyzeWeek(period, members(1), [], "2026-09-28");
  assert.equal(result.partial_week, true); assert.equal(result.required_slots, 4);
  assert.deepEqual(result.dates, ["2026-09-28", "2026-09-29", "2026-09-30"]);
  assert.equal(result.shortfall, 1);
  assert.throws(() => analyzeWeek(period, [], [], "2026-10-05"), /không giao/);
  assert.throws(() => analyzeWeek(period, [], [], "2026-09-08"), /thứ Hai/);
});

test("strict input validation rejects impossible dates, forged scope, types and out-of-period overrides", () => {
  assert.equal(isDate("2026-02-30"), false); assert.equal(isDate("2028-02-29"), true);
  assert.deepEqual(validatePreferences({ ...payload, busy_weekdays: [3, 1, 1] }, period).busy_weekdays, [1, 3]);
  for (const bad of [null, [], { ...payload, person_id: V }, { ...payload, expected_revision: "0" },
    { ...payload, busy_weekdays: [0] }, { ...payload, busy_weekdays: ["1"] },
    { ...payload, date_overrides: [] }, { ...payload, date_overrides: { "2026-09-31": "busy" } },
    { ...payload, date_overrides: { "2026-10-01": "busy" } }, { ...payload, date_overrides: { "2026-09-01": true } }]) {
    assert.throws(() => validatePreferences(bad, period), { statusCode: 400 });
  }
  assert.equal(defaultWeek(period, new Date("2026-09-06T18:00:00Z")), "2026-09-07");
});

function fixture(t, changes = {}) {
  t.mock.method(globalThis, "fetch", () => assert.fail("No external request allowed"));
  t.mock.method(groupAccess, "visibleGroupIds", async () => [A]);
  const people = [
    { id: U, full_name: "Player A", email: "a@example.test", status: "active", activity_eligible: true },
    { id: V, full_name: "Player B", email: "b@example.test", status: "active", activity_eligible: true }
  ];
  const calls = [];
  const repo = {
    async members(id) { calls.push(["members", id]); return { data: people.map((person) => ({ person_id: person.id, person })) }; },
    async memberships(id) { calls.push(["memberships", id]); return { data: people.map((person) => ({ person_id: person.id })) }; },
    async preferences(id) { calls.push(["preferences", id]); return { data: [
      { person_id: U, busy_weekdays: [], date_overrides: {}, revision: 0 },
      { person_id: V, busy_weekdays: [1], date_overrides: { "2026-09-07": "busy" }, revision: 1 }
    ] }; },
    async save(...args) { calls.push(["save", ...args]); return { data: { person_id: args[1], ...args[3], revision: 1 } }; },
    ...changes
  };
  const service = createSessionPlanningService({ repo, annotate: async (rows) => rows,
    getPeriod: async (id, actor) => {
      const value = { ...period, id, group_id: id === P ? A : B };
      await groupAccess.assertGroup(actor, value.group_id);
      return value;
    }
  });
  return { service, calls, people, repo };
}

test("foreign period scope denied before preferences/roster reads; owner remains global", async (t) => {
  const { service, calls } = fixture(t);
  await assert.rejects(service.get(Q, admin, "2026-09-07"), { statusCode: 403 });
  await assert.rejects(service.save(Q, U, payload, admin), { statusCode: 403 });
  assert.deepEqual(calls, []);
  assert.equal((await service.get(Q, owner, "2026-09-07")).members.length, 2);
});

test("members can read/edit only their own availability; other emails and calendars never leave API", async (t) => {
  const { service, calls } = fixture(t);
  const result = await service.get(P, user, "2026-09-07");
  assert.equal(result.members.length, 1); assert.equal(result.members[0].id, U);
  assert.equal(result.analysis.availability.length, 1);
  assert.equal(JSON.stringify(result).includes("b@example"), false);
  assert.equal(JSON.stringify(result).includes(V), false);
  await assert.rejects(service.save(P, V, payload, user), { statusCode: 403 });
  assert.equal(calls.some(([method]) => method === "save"), false);
  await service.save(P, U, payload, user);
  assert.deepEqual(calls.at(-1).slice(1, 4), [P, U, U]);
});

test("inactive/manager/nonmember players cannot be edited even by owner", async (t) => {
  const { service, people, repo, calls } = fixture(t);
  people[1].activity_eligible = false;
  await assert.rejects(service.save(P, V, payload, owner), { statusCode: 403 });
  people[1].activity_eligible = true; people[1].status = "inactive";
  await assert.rejects(service.save(P, V, payload, owner), { statusCode: 403 });
  people[1].status = "active";
  repo.memberships = async () => ({ data: [{ person_id: U }] });
  await assert.rejects(service.save(P, V, payload, owner), { statusCode: 403 });
  assert.equal(calls.some(([method]) => method === "save"), false);
});

test("migration absence, DB errors and stale revisions fail closed without financial fallback", async (t) => {
  const { service } = fixture(t, { preferences: async () => ({ error: { code: "42P01" } }) });
  await assert.rejects(service.get(P, admin, "2026-09-07"), { statusCode: 503, code: "PLANNING_SCHEMA_NOT_READY" });
  assert.throws(() => checkPlanningResult({ error: { code: "40001" } }), { statusCode: 409 });
  assert.throws(() => checkPlanningResult({ error: { code: "42501" } }), { statusCode: 403 });
  assert.throws(() => checkPlanningResult({ error: { code: "UNKNOWN", message: "secret database detail" } }), (error) => !error.message.includes("secret"));
});

test("closed periods retain readable preferences but reject updates", async (t) => {
  const { repo } = fixture(t);
  const save = t.mock.method(repo, "save", async () => assert.fail("No closed-period write"));
  const service = createSessionPlanningService({ repo, annotate: async (rows) => rows,
    getPeriod: async () => ({ ...period, status: "closed" }) });
  assert.equal((await service.get(P, owner, "2026-09-07")).can_edit, false);
  await assert.rejects(service.save(P, U, payload, owner), { statusCode: 409 });
  assert.equal(save.mock.callCount(), 0);
});

test("scoped admins can reach planning without enabling any financial module", () => {
  let next = false;
  adminScopeRollout({ authRole: "admin", path: "/session-planning/period/test", method: "PUT" }, {}, () => { next = true; });
  assert.equal(next, true);
});
