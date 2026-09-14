import test from "node:test";
import assert from "node:assert/strict";
import { createAccountStatusGuard } from "../src/middleware/accountStatus.js";
import { createActivityStatusGuard } from "../src/middleware/activityStatus.js";

async function run(guard, req = {}) {
  const result = { next: false };
  const res = {
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; return this; }
  };
  await guard(req, res, () => { result.next = true; });
  return result;
}

test("inactive actor is blocked for every role and fresh status permits reactivation", async () => {
  let status = "inactive";
  const guard = createAccountStatusGuard(async () => ({ id: "p", status }));
  for (const role of ["user", "admin", "owner"]) {
    const result = await run(guard, { authRole: role, authUser: { email: "person@example.test" } });
    assert.equal(result.status,403);
    assert.equal(result.body.code,"ACCOUNT_INACTIVE");
    assert.equal(result.next,false);
  }
  status = "active";
  assert.equal((await run(guard)).next,true);
});

test("account lookup failure fails closed and absent profile can onboard", async () => {
  assert.equal((await run(createAccountStatusGuard(async () => { throw new Error("DB offline"); }))).status,503);
  assert.equal((await run(createAccountStatusGuard(async () => null))).next,true);
});

function activity(dependencies = {}) {
  return createActivityStatusGuard({
    getRecord: async () => null,
    getPeriodPeople: async () => [],
    getTournamentPeople: async () => [],
    assertActive: async (ids) => {
      if (ids.includes("inactive")) throw new Error("Người đã nghỉ");
    },
    ...dependencies
  });
}

test("admin cannot create debt or bulk activity for inactive people", async () => {
  for (const req of [
    { path: "/debts", body: { person_id: "inactive" } },
    { path: "/pk-matches/bulk", body: { matches: [{ challenger_id: "active", opponent_id: "inactive" }] } },
    { path: "/period-members/bulk", body: { person_ids: ["active","inactive"] } }
  ]) {
    assert.equal((await run(activity(), { ...req, method: "POST", authRole: "owner" })).next,false);
  }
});

test("existing entity lookup prevents omitted person id bypass", async () => {
  const guard = activity({ getRecord: async () => ({ person_id: "inactive" }) });
  for (const path of ["/period-members/id", "/guest-attendances/id", "/debts/id/status", "/payments/id/cancel"]) {
    assert.equal((await run(guard,{ path, method: "PUT", body: {} })).status,400);
  }
});

test("settlement and tournament reject inactive participants", async () => {
  const guard = activity({ getPeriodPeople: async () => ["inactive"], getTournamentPeople: async () => ["inactive"] });
  for (const path of ["/shuttle-settlements/period/id/settle/", "/TOURNAMENTS/id/publish"]) {
    assert.equal((await run(guard,{ path, method: "POST", body: {} })).status,400);
  }
});

test("profile reactivation, history reads, cancellations and payment callback stay available", async () => {
  const guard = activity({ getRecord: async () => ({ person_id: "inactive" }) });
  for (const req of [
    { path: "/people/inactive", method: "PUT", body: { status: "active" } },
    { path: "/debts/person/inactive", method: "GET" },
    { path: "/pk-matches/id", method: "PUT", body: { status: "cancelled" } },
    { path: "/payments/payos-webhook", method: "POST", body: {} }
  ]) {
    assert.equal((await run(guard,req)).next,true);
  }
});
