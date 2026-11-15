import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, setup, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

const tubes = { buyerId: "p2", buyType: "tube", tubeCount: 2, totalPrice: 600000, fundAmount: 200000, buyDate: "2026-11-12" };

test("only the owner reaches the shuttle screen and its actions", async () => {
  const app = setup();
  assert.equal((await app.get(await bearer(), "/admin/shuttles")).status, 403);
  for (const path of ["/admin/shuttles/expenses", "/admin/shuttles/settle", "/admin/shuttles/close", "/admin/shuttles/fund"]) {
    assert.equal((await app.post(await bearer(), path, {})).status, 403, path);
  }
  const body = await (await app.get(await owner(), "/admin/shuttles")).json();
  assert.equal(body.period.id, "k1");
});

test("a shuttle purchase is validated like the old app and sent to the database with the split between fund and buyer", async () => {
  const calls: unknown[] = [];
  const app = setup({ createExpense: async (periodId, input) => void calls.push([periodId, input]) });
  assert.equal((await app.post(await owner(), "/admin/shuttles/expenses", tubes)).status, 200);
  assert.deepEqual(calls, [
    ["k1", { buyerId: "p2", buyType: "tube", tubeCount: 2, shuttlePerTube: 12, singleCount: 0, totalPrice: 600000, fundAmount: 200000, buyDate: "2026-11-12", note: null }],
  ]);
  const bad = [
    { ...tubes, buyerId: "" },
    { ...tubes, tubeCount: 0 },
    { ...tubes, buyType: "single" },
    { ...tubes, buyType: "box" },
    { ...tubes, fundAmount: 700000 },
    { ...tubes, totalPrice: 0 },
    { ...tubes, buyDate: "2099-01-01" },
    { ...tubes, tubeCount: 1.5 },
  ];
  for (const body of bad) assert.equal((await app.post(await owner(), "/admin/shuttles/expenses", body)).status, 400, JSON.stringify(body));
  assert.equal(calls.length, 1);
});

test("expenses and loans of another period are not found; loan actions are limited to repay and cancel", async () => {
  const changed: string[] = [];
  const app = setup({ changeLoan: async (id, action) => void changed.push(`${id}:${action}`) });
  assert.equal((await app.del(await owner(), "/admin/shuttles/expenses/e-old")).status, 404);
  assert.equal((await app.del(await owner(), "/admin/shuttles/expenses/e1")).status, 200);
  assert.equal((await app.post(await owner(), "/admin/shuttles/loans/l-old/repay")).status, 404);
  assert.equal((await app.post(await owner(), "/admin/shuttles/loans/l1/delete")).status, 404);
  assert.equal((await app.post(await owner(), "/admin/shuttles/loans/l1/repay")).status, 200);
  assert.deepEqual(changed, ["l1:repay"]);
});

test("a loan needs a person, a positive quantity and price, and a past date", async () => {
  const loans: unknown[] = [];
  const app = setup({ createLoan: async (_p, input) => void loans.push(input) });
  assert.equal((await app.post(await owner(), "/admin/shuttles/loans", { personId: "p3", quantity: 4, unitPrice: 25000, borrowedAt: "2026-11-14" })).status, 200);
  for (const body of [{ personId: "p3", quantity: 0, unitPrice: 25000 }, { personId: "p3", quantity: 2, unitPrice: -1 }, { quantity: 2, unitPrice: 1 }, { personId: "p3", quantity: 2, unitPrice: 1, borrowedAt: "2099-01-01" }]) {
    assert.equal((await app.post(await owner(), "/admin/shuttles/loans", body)).status, 400);
  }
  assert.equal(loans.length, 1);
});

test("using the fund needs a buyer and a positive whole amount", async () => {
  const calls: unknown[] = [];
  const app = setup({ applyFund: async (...args) => void calls.push(args) });
  assert.equal((await app.post(await owner(), "/admin/shuttles/fund", { buyerId: "p2", amount: 50000 })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/shuttles/fund", { buyerId: "p2", amount: 0 })).status, 400);
  assert.equal((await app.post(await owner(), "/admin/shuttles/fund", { amount: 10 })).status, 400);
  assert.deepEqual(calls, [["k1", "p2", 50000]]);
});

test("settling and closing act on the open period; closing refuses a period on an old ranking rule", async () => {
  const done: string[] = [];
  const app = setup({ settle: async (id, name) => void done.push(`settle:${id}:${name}`), closePeriod: async (id) => void done.push(`close:${id}`) });
  assert.equal((await app.post(await owner(), "/admin/shuttles/settle")).status, 200);
  assert.equal((await app.post(await owner(), "/admin/shuttles/close")).status, 200);
  assert.deepEqual(done, ["settle:k1:Mua 6", "close:k1"]);
  const elo = setup({ getScoringRule: async () => "elo_v1", closePeriod: async () => void done.push("wrong") });
  const res = await elo.post(await owner(), "/admin/shuttles/close");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "CLOSE_UNSUPPORTED");
  const none = setup({ findOpenPeriod: async () => null });
  assert.equal((await none.post(await owner(), "/admin/shuttles/settle")).status, 409);
  assert.equal(done.length, 2);
});
