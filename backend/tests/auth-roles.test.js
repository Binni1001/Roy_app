import test from "node:test";
import assert from "node:assert/strict";
import { getUserRole } from "../src/utils/roles.js";
import { getSessionRole } from "../../frontend/src/utils/appUtils.js";

test("frontend and backend trust only allowlisted app_metadata roles", () => {
  const cases = [
    [undefined, "user"], [null, "user"], [{}, "user"],
    [{ user_metadata: { role: "admin" } }, "user"],
    [{ user_metadata: { role: "owner" } }, "user"],
    ...[undefined, null, "", "ADMIN", "superadmin", ["owner"], { role: "owner" }].map((role) =>
      [{ app_metadata: { role }, user_metadata: { role: "owner" } }, "user"]),
    ...["user", "admin", "owner"].map((role) =>
      [{ app_metadata: { role }, user_metadata: { role: "owner" } }, role])
  ];
  for (const [user, expected] of cases) {
    assert.equal(getUserRole(user), expected);
    assert.equal(getSessionRole({ user }), expected);
  }
});

// Isolated test worker: never use production credentials or perform Auth writes.
process.env.SUPABASE_URL = "https://auth-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key-not-a-secret";
const { supabase } = await import("../src/config/supabase.js");
const { requireAuth, requireAdmin, requireOwner } = await import("../src/middleware/auth.js");
const { adminUsersService } = await import("../src/modules/admin-users/adminUsers.service.js");

function fakeResponse() {
  return { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

test("real authentication and authorization middleware reject forged metadata with 403", async (t) => {
  let authUser;
  const getUser = t.mock.method(supabase.auth, "getUser", async () => ({ data: { user: authUser }, error: null }));
  t.mock.method(supabase, "from", () => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: { id: "person", status: "active" }, error: null })
  }) }) }));
  for (const user of [
    { user_metadata: { role: "admin" } },
    { user_metadata: { role: "owner" } },
    { app_metadata: { role: "user" }, user_metadata: { role: "owner" } },
    { app_metadata: { role: "unknown" }, user_metadata: { role: "owner" } }
  ]) {
    authUser = { id: "user", email: "member@example.test", ...user };
    for (const guard of [requireAdmin, requireOwner]) {
      const res = fakeResponse();
      let reachedHandler = false;
      const req = { headers: { authorization: "Bearer verified-test-token" }, body: { role: "owner" } };
      await requireAuth(req, res, () => guard(req, res, () => { reachedHandler = true; }));
      assert.equal(res.statusCode, 403);
      assert.equal(reachedHandler, false);
      assert.equal(req.authRole, "user");
    }
  }
  assert.equal(getUser.mock.callCount(), 8);
});

test("valid privileged roles work; user metadata cannot override them; revocation is fresh", async (t) => {
  let role = "owner";
  t.mock.method(supabase.auth, "getUser", async () => ({ data: { user: {
    id: "user", email: "member@example.test", app_metadata: { role }, user_metadata: { role: "owner" }
  } } }));
  t.mock.method(supabase, "from", () => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: { status: "active" } })
  }) }) }));
  for (const [nextRole, guard, expected] of [
    ["owner", requireOwner, 200], ["owner", requireAdmin, 200],
    ["admin", requireAdmin, 200], ["admin", requireOwner, 403],
    ["user", requireAdmin, 403]
  ]) {
    role = nextRole;
    const req = { headers: { authorization: "Bearer same-test-token" } };
    const res = fakeResponse();
    let reachedHandler = false;
    await requireAuth(req, res, () => guard(req, res, () => { reachedHandler = true; }));
    assert.equal(res.statusCode, expected);
    assert.equal(reachedHandler, expected === 200);
  }
});

test("missing or invalid tokens never enter privileged handlers", async (t) => {
  const getUser = t.mock.method(supabase.auth, "getUser", async () => ({ error: { message: "invalid" } }));
  for (const authorization of [undefined, "Basic test", "Bearer invalid-token"]) {
    const res = fakeResponse();
    let entered = false;
    await requireAuth({ headers: { authorization } }, res, () => { entered = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(entered, false);
  }
  assert.equal(getUser.mock.callCount(), 1);
});

test("admin listing ignores forged metadata and trusted owner cannot be revoked", async (t) => {
  t.mock.method(supabase.auth.admin, "listUsers", async () => ({ data: { users: [
    { id: "fake", user_metadata: { role: "owner" } },
    { id: "admin", app_metadata: { role: "admin" } },
    { id: "owner", app_metadata: { role: "owner" }, user_metadata: { role: "user" } }
  ] } }));
  assert.deepEqual((await adminUsersService.listAdmins()).map((user) => user.id), ["admin", "owner"]);
  t.mock.method(supabase.auth.admin, "getUserById", async () => ({ data: { user: {
    id: "owner", app_metadata: { role: "owner" }, user_metadata: { role: "user" }
  } } }));
  const update = t.mock.method(supabase.auth.admin, "updateUserById", async () => { throw new Error("Unexpected write"); });
  await assert.rejects(adminUsersService.revokeAdmin("owner"), { statusCode: 403 });
  assert.equal(update.mock.callCount(), 0);
});

test("invite stores privilege only in app_metadata; revoke returns user despite stale metadata", async (t) => {
  t.mock.method(supabase.auth.admin, "listUsers", async () => ({ data: { users: [] } }));
  const invite = t.mock.method(supabase.auth.admin, "inviteUserByEmail", async () => ({ data: { user: {
    id: "new", email: "new@example.test", user_metadata: { full_name: "New Admin" }
  } } }));
  const update = t.mock.method(supabase.auth.admin, "updateUserById", async (id, payload) => ({ data: { user: { id, ...payload } } }));
  assert.equal((await adminUsersService.inviteAdmin({ email: "new@example.test", full_name: "New Admin" })).user.role, "admin");
  assert.equal(invite.mock.calls[0].arguments[1].data.role, undefined);
  assert.equal(update.mock.calls[0].arguments[1].app_metadata.role, "admin");
  t.mock.method(supabase.auth.admin, "getUserById", async () => ({ data: { user: {
    id: "new", app_metadata: { role: "admin" }, user_metadata: { role: "owner" }
  } } }));
  assert.equal((await adminUsersService.revokeAdmin("new")).user.role, "user");
  assert.equal(update.mock.calls[1].arguments[1].app_metadata.role, "user");
});
