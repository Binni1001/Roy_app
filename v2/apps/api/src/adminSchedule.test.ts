import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, setup, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

// Kỳ mở mặc định của testkit: k1 "Mua 6", 2026-11-10 → 2026-12-09.

test("only the owner sees the schedule, which is empty without an open period", async () => {
  const app = setup();
  assert.equal((await app.get(await bearer(), "/admin/schedule")).status, 403);
  const body = await (await app.get(await owner(), "/admin/schedule")).json();
  assert.equal(body.period.id, "k1");
  assert.equal(body.guestFee, 30000);
  const none = await (await setup({ findOpenPeriod: async () => null }).get(await owner(), "/admin/schedule")).json();
  assert.equal(none.period, null);
});

test("opening, closing and reopening a day goes through the database with the owner's account", async () => {
  const calls: string[] = [];
  const app = setup({ mutateDay: async (periodId, date, actor, action) => void calls.push([periodId, date, actor, action].join("|")) });
  assert.equal((await app.post(await owner(), "/admin/schedule/days", { date: "2026-11-20", action: "open" })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/schedule/days", { date: "2026-11-20", action: "close" })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/schedule/days", { date: "2027-02-01", action: "open" })).status, 400);
  assert.equal((await app.post(await owner(), "/admin/schedule/days", { date: "2026-11-20", action: "join" })).status, 400);
  assert.deepEqual(calls, ["k1|2026-11-20|user-1|open", "k1|2026-11-20|user-1|close"]);
});

test("a played session must be inside the open period and not in the future", async () => {
  const created: unknown[] = [];
  const app = setup({ createSession: async (periodId, input) => void created.push([periodId, input]) });
  const ok = await app.post(await owner(), "/admin/sessions", { date: "2026-11-12", shuttles: "6", note: " sân 3 " });
  assert.equal(ok.status, 200);
  assert.deepEqual(created, [["k1", { date: "2026-11-12", shuttles: 6, note: "sân 3" }]]);
  for (const body of [
    { date: "2026-11-01", shuttles: 1 },
    { date: "2099-01-01", shuttles: 1 },
    { date: "2026-11-12", shuttles: -1 },
    { date: "2026-11-12", shuttles: 1.5 },
    { shuttles: 1 },
  ]) {
    assert.equal((await app.post(await owner(), "/admin/sessions", body)).status, 400);
  }
  assert.equal(created.length, 1);
});

test("sessions and guests of another period are not found, and a session with guests is not deleted", async () => {
  const app = setup();
  assert.equal((await app.put(await owner(), "/admin/sessions/s-old", { date: "2026-11-12", shuttles: 1 })).status, 404);
  assert.equal((await app.del(await owner(), "/admin/sessions/s-old")).status, 404);
  assert.equal((await app.post(await owner(), "/admin/sessions/s-old/guests", { personId: "p2" })).status, 404);
  assert.equal((await app.put(await owner(), "/admin/guests/a-old", { amount: 0 })).status, 404);
  assert.equal((await app.del(await owner(), "/admin/guests/nope")).status, 404);
  const busy = setup({ deleteSession: async () => false });
  const res = await busy.del(await owner(), "/admin/sessions/s1");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "SESSION_HAS_GUESTS");
});

test("a guest gets the period's default fee unless another amount is given, through the database function", async () => {
  const calls: unknown[] = [];
  const app = setup({ addGuest: async (...args) => (calls.push(args), true) });
  assert.equal((await app.post(await owner(), "/admin/sessions/s1/guests", { personId: "p2" })).status, 200);
  assert.equal((await app.post(await owner(), "/admin/sessions/s1/guests", { personId: "p3", amount: 0, note: "bạn mời" })).status, 200);
  assert.deepEqual(calls, [
    ["s1", "p2", 30000, null],
    ["s1", "p3", 0, "bạn mời"],
  ]);
  for (const body of [{}, { personId: "p2", amount: -5 }, { personId: "p2", amount: 1.5 }]) {
    assert.equal((await app.post(await owner(), "/admin/sessions/s1/guests", body)).status, 400);
  }
  assert.equal(calls.length, 2);
});

test("changing a guest needs an explicit amount; removing reports whether a fee was cancelled", async () => {
  const app = setup();
  assert.equal((await app.put(await owner(), "/admin/guests/a1", { note: "x" })).status, 400);
  const changed = await app.put(await owner(), "/admin/guests/a1", { amount: 50000 });
  assert.equal(changed.status, 200);
  assert.match((await changed.json()).notice, /Đã đổi phí khách/);
  const removed = await app.del(await owner(), "/admin/guests/a1");
  assert.match((await removed.json()).notice, /hủy phí khách/);
  assert.equal((await app.del(await bearer(), "/admin/guests/a1")).status, 403);
});
