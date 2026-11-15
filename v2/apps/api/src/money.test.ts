import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, setup, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

test("only the owner sees money and reports", async () => {
  const app = setup();
  assert.equal((await app.get(await bearer(), "/admin/money")).status, 403);
  assert.equal((await app.get(await bearer(), "/admin/periods/k1/report")).status, 403);
  assert.equal((await app.post(await bearer(), "/admin/money/collect", {})).status, 403);
  assert.equal((await app.get(await owner(), "/admin/money")).status, 200);
});

test("collecting checks every chosen debt belongs to that person and is still unpaid, then uses the atomic deposit", async () => {
  const calls: unknown[] = [];
  const app = setup({ collect: async (...args) => void calls.push(args) });
  const ok = await app.post(await owner(), "/admin/money/collect", { personId: "p2", debtIds: ["d-p2", "d-p2"], amount: 150000, note: " tiền mặt " });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, [["k1", "p2", 150000, ["d-p2"], "tiền mặt"]]);
  const wrongPerson = await app.post(await owner(), "/admin/money/collect", { personId: "p2", debtIds: ["d-p3"], amount: 1 });
  assert.equal(wrongPerson.status, 409);
  assert.equal((await app.post(await owner(), "/admin/money/collect", { personId: "p2", debtIds: ["paid"], amount: 1 })).status, 409);
  assert.equal((await app.post(await owner(), "/admin/money/collect", { personId: "p2", debtIds: [], amount: 0 })).status, 400);
  assert.equal((await app.post(await owner(), "/admin/money/collect", { personId: "gone", debtIds: [], amount: 10 })).status, 400);
  assert.equal(calls.length, 1);
});

test("a manual charge needs a description; cancelling only touches an unpaid debt of the group", async () => {
  const added: unknown[] = [];
  const app = setup({ addDebt: async (...args) => void added.push(args) });
  assert.equal((await app.post(await owner(), "/admin/money/debts", { personId: "p2", amount: 20000 })).status, 400);
  assert.equal((await app.post(await owner(), "/admin/money/debts", { personId: "p2", amount: 20000, description: "Nước uống" })).status, 200);
  assert.deepEqual(added, [["k1", "p2", 20000, "Nước uống"]]);
  assert.equal((await app.post(await owner(), "/admin/money/debts/d-p2/cancel")).status, 200);
  assert.equal((await app.post(await owner(), "/admin/money/debts/other-group/cancel")).status, 404);
  const raced = setup({ cancelDebt: async () => false });
  assert.equal((await raced.post(await owner(), "/admin/money/debts/d-p2/cancel")).status, 409);
});

test("a reminder is refused when nothing is owed", async () => {
  assert.equal((await setup().post(await owner(), "/admin/money/remind/p2")).status, 200);
  assert.equal((await setup({ remind: async () => 0 }).post(await owner(), "/admin/money/remind/p2")).status, 409);
});

test("fund entries: income goes through the atomic deposit, expense needs a description, refund uses the refund function", async () => {
  const calls: string[] = [];
  const app = setup({
    collect: async (period, person, amount, ids) => void calls.push(`collect:${period}:${person}:${amount}:${ids.length}`),
    addExpense: async (period, person, amount, text) => void calls.push(`expense:${period}:${person}:${amount}:${text}`),
    refund: async (period, person, amount) => void calls.push(`refund:${period}:${person}:${amount}`),
  });
  assert.equal((await app.post(await owner(), "/admin/money/fund", { type: "income", personId: "p2", amount: 50000 })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/money/fund", { type: "expense", amount: 80000 })).status, 400);
  assert.equal((await app.post(await owner(), "/admin/money/fund", { type: "expense", amount: 80000, description: "Thuê sân" })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/money/fund", { type: "refund", personId: "p2", amount: 30000 })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/money/fund", { type: "adjustment", amount: 1 })).status, 400);
  assert.deepEqual(calls, ["collect:k1:p2:50000:0", "expense:k1:null:80000:Thuê sân", "refund:k1:p2:30000"]);
});

test("writing money needs an open period; a report is only for the owner's group", async () => {
  const closed = setup({ findOpenPeriod: async () => null });
  assert.equal((await closed.post(await owner(), "/admin/money/debts", { personId: "p2", amount: 1, description: "x" })).status, 409);
  const app = setup();
  assert.equal((await app.get(await owner(), "/admin/periods/k1/report")).status, 200);
  assert.equal((await app.get(await owner(), "/admin/periods/kx/report")).status, 404);
  assert.equal((await app.get(await owner(), "/admin/periods/none/report")).status, 404);
});
