import test from "node:test";
import assert from "node:assert/strict";
import { assignedGroupIds, canManageGroup, canReadManagedPerson, canEditManagedPerson } from "../src/utils/groupAuthorization.js";
import { adminScopeRollout } from "../src/middleware/adminScopeRollout.js";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const admin = { email: "admin@example.test", app_metadata: { role: "admin", managed_group_ids: [A] } };
const owner = { email: "owner@example.test", app_metadata: { role: "owner" } };
const personA = { id: "person-a", email: "a@example.test", status: "active", account_role: "user", group_id: A, person_groups: [{ group_id: A }] };
const personB = { id: "person-b", email: "b@example.test", status: "active", account_role: "user", group_id: B, person_groups: [{ group_id: B }] };
const shared = { ...personA, id: "shared", person_groups: [{ group_id: A }, { group_id: B }] };

test("only trusted assignments grant group management; owner is global", () => {
  assert.equal(canManageGroup(admin, A), true);
  assert.equal(canManageGroup(admin, B), false);
  assert.equal(canManageGroup(owner, B), true);
  for (const user of [
    { app_metadata: { role: "admin" }, user_metadata: { managed_group_ids: [A] } },
    { app_metadata: { role: "user", managed_group_ids: [A] } },
    { app_metadata: { role: "admin", managed_group_ids: [A, "invalid"] } },
    { app_metadata: { role: "admin", managed_group_ids: A } }
  ]) assert.equal(canManageGroup(user, A), false);
  assert.deepEqual(assignedGroupIds({ app_metadata: { managed_group_ids: [A, A.toUpperCase()] } }), [A]);
});

test("viewing preference and local member roles never grant management; shared profiles need owner", () => {
  assert.equal(canReadManagedPerson(admin, { ...personB, active_group_id: A }), false);
  assert.equal(canReadManagedPerson(admin, { ...personB, group_id: A }), false);
  assert.equal(canEditManagedPerson(admin, personA), true);
  assert.equal(canEditManagedPerson(admin, shared), false);
  assert.equal(canEditManagedPerson(owner, shared), true);
  assert.equal(canEditManagedPerson(admin, { ...personA, account_role: "owner" }), false);
  assert.equal(canEditManagedPerson(admin, { ...personA, account_role: "admin" }), false);
});

test("unreviewed modules are closed to scoped admins, including reads and deletes", () => {
  for (const method of ["GET", "POST", "PUT", "DELETE"]) {
    for (const path of ["/debts", "/balance-offsets/all", "/PAYMENTS/x/cancel", "/pk-matches", "/tournaments"]) {
      let code;
      let next = false;
      adminScopeRollout({ authRole: "admin", method, path }, {
        status(value) { code = value; return this; }, json() {}
      }, () => { next = true; });
      assert.equal(code, 403);
      assert.equal(next, false);
    }
  }
  for (const role of ["owner", "user"]) {
    let next = false;
    adminScopeRollout({ authRole: role, path: "/debts" }, {}, () => { next = true; });
    assert.equal(next, true);
  }
});

process.env.SUPABASE_URL = "https://group-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-a-secret";
const { supabase } = await import("../src/config/supabase.js");
const { peopleRepository } = await import("../src/modules/people/people.repository.js");
const { peopleService } = await import("../src/modules/people/people.service.js");
const { periodsRepository } = await import("../src/modules/periods/periods.repository.js");
const { periodsService } = await import("../src/modules/periods/periods.service.js");
const { periodsController } = await import("../src/modules/periods/periods.controller.js");
const { adminUsersService } = await import("../src/modules/admin-users/adminUsers.service.js");
const { groupAccess } = await import("../src/services/groupAccess.js");
const { adminResourceScope } = await import("../src/middleware/adminResourceScope.js");

function stubAuth(t) {
  t.mock.method(supabase.auth.admin, "listUsers", async () => ({ data: { users: [] } }));
}

test("people list and ID lookup enforce two-group isolation; owner needs no person profile", async (t) => {
  stubAuth(t);
  t.mock.method(peopleRepository, "getAll", async () => ({ data: [personA, personB, shared] }));
  t.mock.method(peopleRepository, "getById", async () => ({ data: personB }));
  const visible = await peopleService.getAllPeople(admin, "admin");
  assert.deepEqual(visible.map((p) => p.id), ["person-a", "shared"]);
  assert.deepEqual(visible[1].person_groups, [{ group_id: A }]);
  assert.equal(visible[1].can_manage_profile, false);
  assert.equal((await peopleService.getAllPeople(owner, "owner")).length, 3);
  await assert.rejects(peopleService.getManagedPerson(admin, "person-b"), { statusCode: 403 });
  assert.equal((await peopleService.getManagedPerson(owner, "person-b")).id, "person-b");
});

test("foreign and shared profile edits/password/deletion fail before mutation", async (t) => {
  stubAuth(t);
  let target = personB;
  t.mock.method(peopleRepository, "getById", async () => ({ data: target }));
  const update = t.mock.method(peopleRepository, "update", async () => { throw new Error("Unexpected write"); });
  const remove = t.mock.method(peopleRepository, "remove", async () => { throw new Error("Unexpected delete"); });
  const password = t.mock.method(supabase.auth.admin, "updateUserById", async () => { throw new Error("Unexpected Auth write"); });
  for (const person of [personB, shared]) {
    target = person;
    await assert.rejects(peopleService.updateManagedPerson(admin, target.id, { full_name: "Changed" }), { statusCode: 403 });
    await assert.rejects(peopleService.updateManagedPassword(admin, target.id, "test-password"), { statusCode: 403 });
    await assert.rejects(peopleService.deleteManagedPerson(admin, target.id), { statusCode: 403 });
  }
  target = personA;
  for (const key of ["email", "group_id", "active_group_id"]) {
    await assert.rejects(peopleService.updateManagedPerson(admin, target.id, { [key]: B }), { statusCode: 403 });
  }
  assert.equal(update.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);
  assert.equal(password.mock.callCount(), 0);
});

test("admin can update local player fields and owner can manage a foreign player", async (t) => {
  stubAuth(t);
  t.mock.method(peopleRepository, "getById", async () => ({ data: personA }));
  const update = t.mock.method(peopleRepository, "update", async (id, payload) => ({ data: { id, ...payload } }));
  assert.equal((await peopleService.updateManagedPerson(admin, "person-a", { full_name: "Local Player" })).full_name, "Local Player");
  assert.equal((await peopleService.updateManagedPerson(owner, "person-a", { email: "new@example.test" })).email, "new@example.test");
  assert.equal(update.mock.callCount(), 2);
});

test("period list receives scope, guessed foreign ID/update is denied and owner is global", async (t) => {
  const list = t.mock.method(periodsRepository, "getAll", async (ids) => ({ data: ids === null ? [A, B] : ids }));
  assert.deepEqual(await periodsService.getAllPeriods(admin), [A]);
  assert.deepEqual(await periodsService.getAllPeriods(owner), [A, B]);
  assert.deepEqual(list.mock.calls[0].arguments[0], [A]);
  t.mock.method(periodsRepository, "getById", async () => ({ data: { id: "period-b", group_id: B } }));
  await assert.rejects(periodsService.getAccessiblePeriod("period-b", admin), { statusCode: 403 });
  assert.equal((await periodsService.getAccessiblePeriod("period-b", owner)).group_id, B);
  const update = t.mock.method(periodsRepository, "update", async () => { throw new Error("Unexpected write"); });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
  await periodsController.update({ authUser: admin, params: { id: "period-b" }, body: { name: "attack" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(update.mock.callCount(), 0);
});

test("foreign period creation is rejected before database insert", async (t) => {
  t.mock.method(periodsRepository, "getActiveGroupByEmail", async () => ({ data: { active_group_id: A } }));
  const create = t.mock.method(periodsRepository, "create", async () => { throw new Error("Unexpected write"); });
  await assert.rejects(periodsService.createPeriod({ name: "Other club", group_id: B,
    start_date: "2026-09-01", end_date: "2026-09-30", status: "open"
  }, admin, "admin"), { statusCode: 403 });
  assert.equal(create.mock.callCount(), 0);
});

test("assignments validate every group, preserve role, and allow removing all assignments", async (t) => {
  t.mock.method(supabase.auth.admin, "getUserById", async () => ({ data: { user: admin } }));
  t.mock.method(supabase, "from", () => ({ select: () => ({ in: async () => ({ data: [{ id: A }] }) }) }));
  const update = t.mock.method(supabase.auth.admin, "updateUserById", async (id, payload) => ({ data: { user: { id, app_metadata: { ...admin.app_metadata, ...payload.app_metadata } } } }));
  await assert.rejects(adminUsersService.assignGroups("admin", [A, B]), { statusCode: 400 });
  await assert.rejects(adminUsersService.assignGroups("admin", ["invalid"]), { statusCode: 400 });
  assert.equal(update.mock.callCount(), 0);
  const result = await adminUsersService.assignGroups("admin", [A]);
  assert.equal(result.role, "admin");
  assert.deepEqual(result.managed_group_ids, [A]);
  assert.deepEqual((await adminUsersService.assignGroups("admin", [])).managed_group_ids, []);
});

test("group selection alone cannot bypass assignments and no assignment means no scope", async () => {
  await assert.rejects(groupAccess.resolveManagedGroup(admin, { active_group_id: B }), { statusCode: 403 });
  const unassigned = { app_metadata: { role: "admin" } };
  assert.deepEqual(await groupAccess.visibleGroupIds(unassigned), []);
  await assert.rejects(groupAccess.assertGroup(unassigned, A, true), { statusCode: 403 });
});

test("resource scope is checked before allowing cached write replay", async (t) => {
  t.mock.method(peopleService, "assertManagedPerson", async () => { throw Object.assign(new Error("No longer assigned"), { statusCode: 403 }); });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
  let replayReached = false;
  await adminResourceScope({ authRole: "admin", authUser: admin, method: "PUT", path: "/PEOPLE/person-a/password" }, res, () => { replayReached = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(replayReached, false);
});

test("assignment writes cannot restore a concurrently revoked global role", async (t) => {
  t.mock.method(supabase.auth.admin, "getUserById", async () => ({ data: { user: admin } }));
  const update = t.mock.method(supabase.auth.admin, "updateUserById", async (id, payload) => {
    assert.equal(payload.app_metadata.role, undefined);
    return { data: { user: { id, app_metadata: { role: "user", ...payload.app_metadata } } } };
  });
  const result = await adminUsersService.assignGroups("admin", []);
  assert.equal(result.role, "user");
  assert.equal(update.mock.callCount(), 1);
});
