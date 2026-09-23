import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
process.env.SUPABASE_URL = "https://attendance-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-a-secret";
const { supabase } = await import("../src/config/supabase.js");
const { attendanceGroupScope: guard } = await import("../src/middleware/attendanceGroupScope.js");
const { adminScopeRollout } = await import("../src/middleware/adminScopeRollout.js");
const { periodsRepository } = await import("../src/modules/periods/periods.repository.js");
const { periodMembersRepository: members } = await import("../src/modules/period-members/periodMembers.repository.js");
const { guestAttendancesRepository: guests } = await import("../src/modules/guest-attendances/guestAttendances.repository.js");
const { badmintonSessionsRepository: sessions } = await import("../src/modules/badminton-sessions/badmintonSessions.repository.js");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const admin = { app_metadata: { role: "admin", managed_group_ids: [A] } };
const owner = { app_metadata: { role: "owner" } };
async function run(path, method = "GET", body = {}, authUser = admin) {
  const result = { next: false, status: 200 };
  const req = { path, method, body, authUser };
  await guard(req, {
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; }
  }, () => { result.next = true; });
  return { ...result, groups: req.visibleGroupIds };
}
function fixture(t, status = "open") {
  t.mock.method(periodsRepository, "getById", async (id) => ({ data: { id, group_id: id === "pa" ? A : B, status } }));
  t.mock.method(members, "getById", async (id) => ({ data: { id, person_id: "person", period_id: id === "ma" ? "pa" : "pb" } }));
  t.mock.method(guests, "getById", async (id) => ({ data: { id, person_id: "person", session_id: id === "ga" ? "sa" : "sb" } }));
  t.mock.method(sessions, "getById", async (id) => ({ data: { id, period_id: id === "sa" ? "pa" : "pb" } }));
}

test("member and guest parent paths/IDs enforce actual group for reads and writes", async (t) => {
  fixture(t);
  for (const path of ["/period-members/period/pb", "/period-members/mb", "/guest-attendances/session/sb", "/guest-attendances/gb"]) {
    assert.equal((await run(path)).status, 403);
  }
  for (const path of ["/period-members/mb", "/guest-attendances/gb"]) {
    for (const method of ["PUT", "DELETE"]) assert.equal((await run(path, method)).status, 403);
  }
  for (const path of ["/period-members/ma", "/guest-attendances/ga"]) assert.equal((await run(path)).next, true);
  assert.equal((await run("/period-members/mb", "GET", {}, owner)).next, true);
});

test("collection and person attendance reads carry trusted query scope", async () => {
  assert.deepEqual((await run("/guest-attendances")).groups, [A]);
  assert.deepEqual((await run("/guest-attendances/person/person")).groups, [A]);
  assert.equal((await run("/guest-attendances", "GET", {}, owner)).groups, null);
});

test("attendance cannot change stored parent or person through body even for owner", async (t) => {
  fixture(t);
  assert.equal((await run("/period-members/ma", "PUT", { period_id: "pb" }, owner)).status, 400);
  assert.equal((await run("/guest-attendances/ga", "PUT", { session_id: "sb" }, owner)).status, 400);
  assert.equal((await run("/guest-attendances/ga", "PUT", { person_id: "other" }, owner)).status, 400);
});

test("bulk rejects any foreign or inactive membership before the handler, and accepts all active memberships", async (t) => {
  fixture(t);
  let query;
  t.mock.method(supabase, "from", (table) => {
    assert.equal(table, "person_groups");
    query = { select() { return this; }, eq(field, value) { if (field === "status") assert.equal(value, "active"); return this; },
      async in() { return { data: [{ person_id: "person" }] }; } };
    return query;
  });
  assert.equal((await run("/period-members/bulk", "POST", { period_id: "pa", person_ids: ["person", "other"] }, owner)).status, 403);
  assert.equal((await run("/period-members/bulk", "POST", { period_id: "pa", person_ids: ["person"] }, owner)).next, true);
  assert.equal((await run("/guest-attendances", "POST", { session_id: "sa", person_id: "other" }, owner)).status, 403);
});

test("closed periods reject member and guest changes while historical reads remain available", async (t) => {
  fixture(t, "closed");
  for (const path of ["/period-members/ma", "/guest-attendances/ga"]) {
    assert.equal((await run(path, "PUT", {}, owner)).status, 409);
    assert.equal((await run(path, "DELETE", {}, owner)).status, 409);
    assert.equal((await run(path, "GET", {}, owner)).next, true);
  }
});

test("failed lookups and malformed encoded paths never enter handlers", async (t) => {
  t.mock.method(members, "getById", async () => ({ error: { message: "private DB detail" } }));
  const result = await run("/period-members/ma");
  assert.equal(result.next, false);
  assert.doesNotMatch(result.body.message, /private DB detail/);
  assert.equal((await run("/period-members/%zz")).next, false);
});

test("guest collection SQL scopes both parent joins and limits person query too", async (t) => {
  const calls = [];
  const query = { select(value) { calls.push(value); return this; }, eq(...args) { calls.push(args); return this; },
    in(...args) { calls.push(args); return this; }, async order() { return { data: [] }; } };
  t.mock.method(supabase, "from", () => query);
  await guests.getAll([A]);
  assert.match(calls[0], /session:badminton_sessions!inner/);
  assert.match(calls[0], /period:periods!inner/);
  assert.deepEqual(calls[1], ["session.period.group_id", [A]]);
  calls.length = 0;
  await guests.getByPersonId("person", [A]);
  assert.deepEqual(calls[1], ["person_id", "person"]);
  assert.deepEqual(calls[2], ["session.period.group_id", [A]]);
  calls.length = 0;
  assert.deepEqual(await guests.getAll([]), { data: [], error: null });
  assert.deepEqual(calls, []);
});

test("rollout opens reads and nonfinancial session writes, not guest/member writes or session deletion", () => {
  for (const module of ["period-members", "guest-attendances", "badminton-sessions"]) {
    for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE"]) {
      let next = false, code;
      adminScopeRollout({ authRole: "admin", path: `/${module}`, method }, {
        status(value) { assert.equal(value, 403); return this; }, json(value) { code = value.code; }
      }, () => { next = true; });
      const allowed = ["GET", "HEAD"].includes(method) || module === "badminton-sessions" && ["POST", "PUT"].includes(method);
      assert.equal(next, allowed);
      if (!allowed) assert.equal(code, "GROUP_FINANCE_SCOPE_NOT_READY");
    }
  }
});

test("attendance checks run before replay and router handlers; self ownership remains guarded", () => {
  const app = readFileSync("src/app.js", "utf8");
  assert.ok(app.indexOf('app.use("/api", attendanceGroupScope)') < app.indexOf('app.use("/api", idempotencyMiddleware)'));
  const routes = readFileSync("src/modules/guest-attendances/guestAttendances.routes.js", "utf8");
  assert.match(routes, /router.get\("\/person\/:personId",.*requireSelfPersonOrAdmin/);
});
