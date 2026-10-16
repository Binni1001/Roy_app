import assert from "node:assert/strict";
import test from "node:test";
import { assertPkPeriodWritable } from "../src/modules/pk-matches/pkHistory.js";
import { pkMatchesService as service } from "../src/modules/pk-matches/pkMatches.service.js";
import { pkMatchesRepository as repo } from "../src/modules/pk-matches/pkMatches.repository.js";

const board = (type = "doubles") => ({
  period_id: "legacy-demo", match_type: type, archived: true,
  scoring_method: "legacy_wilson", scoring_rule: "legacy_wilson_v1",
  recovery: { original_snapshot_verified: false },
  ranked: [{ id: "demo-a", full_name: "Demo Player A", rank: 1, points: 9, wins: 3, losses: 0 }], qualifying: [],
});

test("legacy snapshots come from private storage without bundled identities or recalculation", async (t) => {
  const frozen = board();
  t.mock.method(repo, "getSnapshot", async () => ({ data: { result: frozen } }));
  t.mock.method(repo, "getArchivedPlayerAvatars", async () => ({ data: [] }));
  t.mock.method(repo, "getScoringRule", async () => assert.fail("Must read snapshot first"));
  t.mock.method(repo, "getSeasonRatings", async () => assert.fail("Must not recalculate history"));
  assert.deepEqual(await service.getLeaderboard("legacy-demo", "doubles"), frozen);
  const result = await service.getLeaderboard("legacy-demo", "doubles");
  result.ranked[0].rank = 999;
  assert.equal(frozen.ranked[0].rank, 1);
});

test("avatar enrichment changes only avatars and lookup failure preserves history", async (t) => {
  const frozen = board();
  t.mock.method(repo, "getSnapshot", async () => ({ data: { result: frozen } }));
  const images = t.mock.method(repo, "getArchivedPlayerAvatars", async () => ({ data: [{ id: "demo-a", avatar_url: "https://example.test/avatar.jpg", rank: 999 }] }));
  assert.deepEqual((await service.getLeaderboard("legacy-demo", "doubles")).ranked[0], { ...frozen.ranked[0], avatar_url: "https://example.test/avatar.jpg" });
  images.mock.mockImplementation(async () => { throw new Error("unavailable"); });
  assert.deepEqual(await service.getLeaderboard("legacy-demo", "doubles"), frozen);
});

test("all mutation paths reject closed history before repository writes", async (t) => {
  t.mock.method(repo, "getScoringRule", async () => ({ data: { status: "closed" } }));
  t.mock.method(service, "getById", async () => ({ period_id: "legacy-demo" }));
  for (const method of ["create", "createMany", "update", "remove", "finalize", "correctCompleted", "correctResult", "voidResult"]) {
    t.mock.method(repo, method, async () => assert.fail("Unexpected historical write"));
  }
  for (const action of [
    () => service.create({ period_id: "legacy-demo" }, true),
    () => service.createBulk([{}], true, "legacy-demo"),
    () => service.update("old", {}, true),
    () => service.finalize("old", {}, true),
    () => service.correctResult("old", {}, true),
    () => service.remove("old"),
    () => service.voidResult("old", "reason", {}),
  ]) await assert.rejects(action, /đã được lưu lịch sử/);
});

test("draft, missing and lookup-error periods fail closed; only open periods are writable", async (t) => {
  const state = t.mock.method(repo, "getScoringRule", async () => ({ data: { status: "draft" } }));
  await assert.rejects(() => assertPkPeriodWritable("demo"), /không đang mở/);
  state.mock.mockImplementation(async () => ({ data: null }));
  await assert.rejects(() => assertPkPeriodWritable("demo"), /không đang mở/);
  state.mock.mockImplementation(async () => ({ error: { message: "unavailable" } }));
  await assert.rejects(() => assertPkPeriodWritable("demo"), /Không thể kiểm tra/);
  state.mock.mockImplementation(async () => ({ data: { status: "open" } }));
  await assertPkPeriodWritable("demo");
});
