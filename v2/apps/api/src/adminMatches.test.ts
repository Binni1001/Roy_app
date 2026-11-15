import assert from "node:assert/strict";
import { test } from "node:test";
import { bearer, setup, stored, token } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});
const scores = { setScores: [{ challenger: 21, opponent: 18 }, { challenger: 19, opponent: 21 }, { challenger: 21, opponent: 10 }] };

test("only the owner manages matches", async () => {
  const app = setup();
  assert.equal((await app.get(await bearer(), "/admin/matches")).status, 403);
  assert.equal((await app.post(await bearer(), "/admin/matches/m1/void", { reason: "nhập nhầm" })).status, 403);
  assert.equal((await app.get(await owner(), "/admin/matches")).status, 200);
});

test("the owner can cancel or record any open match, even without playing in it", async () => {
  const calls: string[] = [];
  const app = setup({
    getMatch: async () => stored({ challengerIds: ["x"], opponentIds: ["y"] }),
    setMatchStatus: async (id, status) => (calls.push(`${id}:${status}`), true),
    finalizeMatch: async (id, winner, s, email) => void calls.push(`${id}:${winner}:${s.length}:${email}`),
  });
  assert.equal((await app.post(await owner(), "/admin/matches/m1/cancel")).status, 200);
  assert.equal((await app.post(await owner(), "/admin/matches/m1/result", scores)).status, 200);
  assert.deepEqual(calls, ["m1:cancelled", "m1:challenger:3:a@b.c"]);
});

test("correcting needs a completed match and the version the owner saw; the winner comes from the scores", async () => {
  const calls: unknown[] = [];
  const done = setup({ getMatch: async () => stored({ status: "completed" }), correctMatch: async (...args) => void calls.push(args) });
  assert.equal((await done.post(await owner(), "/admin/matches/m1/correct", scores)).status, 400);
  const ok = await done.post(await owner(), "/admin/matches/m1/correct", { ...scores, expectedUpdatedAt: "2026-11-12T10:00:00Z" });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, [["m1", "challenger", scores.setScores, "2026-11-12T10:00:00Z", "a@b.c"]]);
  const open = setup({ correctMatch: async () => void (calls as unknown[]).push("no") });
  assert.equal((await open.post(await owner(), "/admin/matches/m1/correct", { ...scores, expectedUpdatedAt: "2026-11-12T10:00:00Z" })).status, 409);
  assert.equal(calls.length, 1);
});

test("voiding needs a reason and a completed match", async () => {
  const voided: string[] = [];
  const done = setup({ getMatch: async () => stored({ status: "completed" }), voidMatch: async (id, reason) => void voided.push(`${id}:${reason}`) });
  assert.equal((await done.post(await owner(), "/admin/matches/m1/void", { reason: "x" })).status, 400);
  assert.equal((await done.post(await owner(), "/admin/matches/m1/void", { reason: " Nhập nhầm đội " })).status, 200);
  assert.deepEqual(voided, ["m1:Nhập nhầm đội"]);
  assert.equal((await setup().post(await owner(), "/admin/matches/m1/void", { reason: "Nhập nhầm" })).status, 409);
});

test("matches of another group are not found; matches of a past period are locked", async () => {
  const other = setup({ getMatch: async () => stored({ groupId: "other" }) });
  assert.equal((await other.post(await owner(), "/admin/matches/m1/cancel")).status, 404);
  const old = setup({ getMatch: async () => stored({ periodId: "k0" }) });
  const res = await old.post(await owner(), "/admin/matches/m1/cancel");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "PERIOD_LOCKED");
  assert.equal((await setup().post(await owner(), "/admin/matches/m1/delete")).status, 404);
});
