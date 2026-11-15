import assert from "node:assert/strict";
import { test } from "node:test";
import { adminPeriod, bearer, setup, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

const input = { name: " Mùa  7 ", startDate: "2026-12-10", endDate: "2027-01-09", fixedMemberFee: "150000", guestFeePerSession: 30000 };

test("only the owner sees and changes periods, for the group being viewed", async () => {
  const seen: string[] = [];
  const app = setup({ listPeriods: async (groupId) => (seen.push(groupId), []) });
  assert.equal((await app.get(await bearer(), "/admin/periods")).status, 403);
  assert.equal((await app.post(await bearer(), "/admin/periods", input)).status, 403);
  assert.equal((await app.get(await owner(), "/admin/periods")).status, 200);
  assert.deepEqual(seen, ["g1"]);
});

test("a new period is always a cleaned draft in the owner's group", async () => {
  const created: unknown[] = [];
  const app = setup({ createPeriod: async (groupId, period) => void created.push([groupId, period]) });
  assert.equal((await app.post(await owner(), "/admin/periods", { ...input, status: "open" })).status, 201);
  assert.deepEqual(created, [
    ["g1", { name: "Mùa 7", startDate: "2026-12-10", endDate: "2027-01-09", fixedMemberFee: 150000, guestFeePerSession: 30000, note: null }],
  ]);
  const bad = [
    { ...input, name: "" },
    { ...input, endDate: "2026-12-01" },
    { ...input, startDate: "2026-02-30" },
    { ...input, fixedMemberFee: -1 },
    { ...input, guestFeePerSession: 12.5 },
  ];
  for (const body of bad) assert.equal((await app.post(await owner(), "/admin/periods", body)).status, 400);
  assert.equal(created.length, 1);
});

test("periods of another group are not found, and only a draft can be opened", async () => {
  const opened: string[] = [];
  const app = setup({ setPeriodStatus: async (id) => void opened.push(id) });
  assert.equal((await app.post(await owner(), "/admin/periods/kx/open")).status, 404);
  assert.equal((await app.put(await owner(), "/admin/periods/kx", input)).status, 404);
  assert.equal((await app.get(await owner(), "/admin/periods/kx/roster")).status, 404);
  assert.equal((await app.post(await owner(), "/admin/periods/k1/open")).status, 409);
  assert.equal((await app.post(await owner(), "/admin/periods/kd/open")).status, 200);
  assert.deepEqual(opened, ["kd"]);
});

test("a closed period cannot be edited or receive members", async () => {
  const closed = setup({ getPeriod: async (id) => ({ ...adminPeriod("closed"), id, groupId: "g1" }) });
  assert.equal((await closed.put(await owner(), "/admin/periods/k1", input)).status, 409);
  assert.equal((await closed.post(await owner(), "/admin/periods/k1/members", { personIds: ["p2"] })).status, 409);
});

test("adding members goes through the database function once, de-duplicated, and reports the fees created", async () => {
  const calls: unknown[] = [];
  const app = setup({ addPeriodMembers: async (id, ids) => (calls.push([id, ids]), { added: 2, skipped: 1, feesCreated: 1 }) });
  const res = await app.post(await owner(), "/admin/periods/k1/members", { personIds: ["p2", "p3", "p2", "p4"] });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [["k1", ["p2", "p3", "p4"]]]);
  assert.match((await res.json()).notice, /thêm 2 người, tạo 1 khoản phí cố định, bỏ qua 1/);
  for (const body of [{ personIds: [] }, { personIds: "p2" }, { personIds: [1] }, {}]) {
    assert.equal((await app.post(await owner(), "/admin/periods/k1/members", body)).status, 400);
  }
  assert.equal(calls.length, 1);
});

test("changing a member validates the input, checks the group and the settlement, then explains the fee change", async () => {
  const calls: unknown[] = [];
  const app = setup({ updatePeriodMember: async (...args) => (calls.push(args), "fee_paid_refund_needed") });
  const ok = await app.put(await owner(), "/admin/period-members/m1", { status: "guest", discountPercent: 50 });
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).notice, /hoàn tiền/);
  assert.deepEqual(calls, [["m1", "guest", 50]]);
  assert.equal((await app.put(await owner(), "/admin/period-members/m1", { status: "vip", discountPercent: 0 })).status, 400);
  assert.equal((await app.put(await owner(), "/admin/period-members/m1", { status: "fixed", discountPercent: 30 })).status, 400);
  assert.equal((await app.put(await owner(), "/admin/period-members/m-other", { status: "fixed", discountPercent: 0 })).status, 404);
  assert.equal((await app.put(await owner(), "/admin/period-members/nope", { status: "fixed", discountPercent: 0 })).status, 404);

  const settled = setup({
    getPeriod: async (id) => ({ ...adminPeriod("open", true), id, groupId: "g1" }),
    updatePeriodMember: async () => ((calls as unknown[]).push("settled"), "none"),
  });
  const refused = await settled.put(await owner(), "/admin/period-members/m1", { status: "fixed", discountPercent: 0 });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).code, "PERIOD_SETTLED");
  assert.equal(calls.length, 1);
});
