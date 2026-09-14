import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://session-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-a-secret";
const { supabase } = await import("../src/config/supabase.js");
const { badmintonSessionsService: service } = await import("../src/modules/badminton-sessions/badmintonSessions.service.js");
const { badmintonSessionsRepository: repo } = await import("../src/modules/badminton-sessions/badmintonSessions.repository.js");
const { badmintonSessionsController: controller } = await import("../src/modules/badminton-sessions/badmintonSessions.controller.js");
const { periodsRepository } = await import("../src/modules/periods/periods.repository.js");
const { groupAccess } = await import("../src/services/groupAccess.js");
const { adminResourceScope } = await import("../src/middleware/adminResourceScope.js");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const admin = { app_metadata: { role: "admin", managed_group_ids: [A] } };
const owner = { app_metadata: { role: "owner" } };
const member = { email: "member@example.test", app_metadata: { role: "user" } };

function fixtures(t, status = "open") {
  t.mock.method(periodsRepository, "getById", async (id) => ({ data: { id, group_id: id === "period-a" ? A : B, status } }));
  t.mock.method(repo, "getById", async (id) => ({ data: { id, period_id: id === "session-a" ? "period-a" : "period-b" } }));
}

test("session list filters groups in the database, uses an inner parent join and fails closed for no assignments", async (t) => {
  const calls = [];
  const query = {
    select(value) { calls.push(["select", value]); return this; },
    in(...args) { calls.push(["in", ...args]); return this; },
    async order() { return { data: [] }; }
  };
  t.mock.method(supabase, "from", () => query);
  await service.getAll(admin);
  assert.match(calls[0][1], /period:periods!inner/);
  assert.deepEqual(calls[1], ["in", "period.group_id", [A]]);
  calls.length = 0;
  await service.getAll({ app_metadata: { role: "admin" } });
  assert.deepEqual(calls, []);
  await service.getAll(owner);
  assert.doesNotMatch(calls[0][1], /!inner/);
  assert.equal(calls.length, 1);
});

test("direct session IDs and period reads reject another group before returning data", async (t) => {
  fixtures(t);
  const reads = t.mock.method(repo, "getByPeriodId", async () => ({ data: [] }));
  await assert.rejects(service.getById("session-b", admin), { statusCode: 403 });
  await assert.rejects(service.getByPeriod("period-b", admin), { statusCode: 403 });
  assert.equal(reads.mock.callCount(), 0);
  assert.equal((await service.getById("session-a", admin)).id, "session-a");
  assert.equal((await service.getById("session-b", owner)).id, "session-b");
});

test("ordinary members can read only active membership groups and cannot write", async (t) => {
  fixtures(t);
  t.mock.method(groupAccess, "visibleGroupIds", async () => [A]);
  t.mock.method(repo, "getByPeriodId", async () => ({ data: [] }));
  assert.deepEqual(await service.getByPeriod("period-a", member), []);
  await assert.rejects(service.getByPeriod("period-b", member), { statusCode: 403 });
  await assert.rejects(service.create({ period_id: "period-a", play_date: "2026-01-01" }, member), { statusCode: 403 });
});

test("cross-group create/update/delete never reach mutations; payload cannot disguise the real parent", async (t) => {
  fixtures(t);
  const writes = ["create", "update", "remove"].map((method) => t.mock.method(repo, method, async () => ({ data: {} })));
  await assert.rejects(service.create({ period_id: "period-b", play_date: "2026-01-01" }, admin), { statusCode: 403 });
  await assert.rejects(service.update("session-b", { period_id: "period-a" }, admin), { statusCode: 403 });
  await assert.rejects(service.remove("session-b", admin), { statusCode: 403 });
  for (const write of writes) assert.equal(write.mock.callCount(), 0);
});

test("session updates require an open period and cannot transfer parents", async (t) => {
  fixtures(t, "closed");
  const write = t.mock.method(repo, "update", async () => ({ data: {} }));
  await assert.rejects(service.update("session-a", { note: "test" }, owner), /dang mo/);
  assert.equal(write.mock.callCount(), 0);
});

test("valid session writes work while malformed counts and parent changes are rejected", async (t) => {
  fixtures(t);
  t.mock.method(repo, "create", async (payload) => ({ data: payload }));
  t.mock.method(repo, "update", async (id, payload) => ({ data: { id, ...payload } }));
  const payload = { period_id: "period-a", play_date: "2026-01-01", shuttle_used_count: 2 };
  assert.equal((await service.create(payload, admin)).shuttle_used_count, 2);
  assert.equal((await service.update("session-a", { note: "ok" }, admin)).note, "ok");
  await assert.rejects(service.update("session-a", { period_id: "period-b" }, owner), /ky khac/);
  for (const count of [-1, 0.5, "abc", Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(service.create({ ...payload, shuttle_used_count: count }, owner), /so nguyen/);
    await assert.rejects(service.update("session-a", { shuttle_used_count: count }, owner), /so nguyen/);
  }
});

test("controller preserves forbidden status and resource guard blocks replay of moved sessions", async (t) => {
  fixtures(t);
  let status;
  const res = { status(value) { status = value; return this; }, json() {} };
  await controller.getByPeriod({ params: { periodId: "period-b" }, authUser: admin }, res);
  assert.equal(status, 403);
  let next = false;
  await adminResourceScope({ method: "PUT", path: "/badminton-sessions/session-b", authRole: "admin", authUser: admin, body: { period_id: "period-a" } }, res, () => { next = true; });
  assert.equal(status, 403);
  assert.equal(next, false);
});

test("permission lookup failure does not fall through to a session query", async (t) => {
  t.mock.method(periodsRepository, "getById", async () => ({ error: { message: "lookup unavailable" } }));
  const reads = t.mock.method(repo, "getByPeriodId", async () => ({ data: [] }));
  await assert.rejects(service.getByPeriod("period-a", admin), /lookup unavailable/);
  assert.equal(reads.mock.callCount(), 0);
});
