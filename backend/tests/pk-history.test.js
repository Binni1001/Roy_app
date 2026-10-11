import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { archivedPkLeaderboard, assertPkPeriodWritable } from "../src/modules/pk-matches/pkHistory.js";
import { pkMatchesService } from "../src/modules/pk-matches/pkMatches.service.js";
import { pkMatchesRepository } from "../src/modules/pk-matches/pkMatches.repository.js";
import { computeLeaderboard } from "../../docs/history/pk-june-2026/legacy-leaderboard.mjs";

const june = "34ac4b6a-675c-585c-84c0-ab24ba69f50c";

test("June archives exactly replay the original UI from preserved evidence, not Elo or new rules", async () => {
  const original = JSON.parse(await readFile(new URL("../../docs/history/pk-june-2026/recovery.json", import.meta.url), "utf8"));
  assert.equal(createHash("sha256").update(JSON.stringify(original.evidence)).digest("hex"), original.evidence_sha256);
  const people = [...new Map(original.evidence.matches.flatMap((m) =>
    [m.challenger, m.challenger_partner, m.opponent, m.opponent_partner].filter(Boolean)).map((p) => [p.id, p])).values()];
  for (const type of ["singles", "doubles"]) {
    const archive = archivedPkLeaderboard(june, type);
    assert.deepEqual(archive.ranked, computeLeaderboard(original.evidence.matches, type, people));
    assert.equal(archive.archived, true);
    assert.equal(archive.scoring_method, "legacy_wilson");
    assert.equal(archive.recovery.original_snapshot_verified, false);
    assert.deepEqual(archive.qualifying, []);
  }
  const damaged = archivedPkLeaderboard(june, "doubles");
  damaged.ranked[0].rank = 999;
  assert.equal(archivedPkLeaderboard(june, "doubles").ranked[0].rank, 1);
});

test("June reads need no Elo ledger and other periods retain the same Elo calculation", async (t) => {
  t.mock.method(pkMatchesRepository, "getSnapshot", async () => ({ data: null }));
  t.mock.method(pkMatchesRepository, "getScoringRule", async () => ({ data: { pk_scoring_rule: "elo_v1", status: "open" } }));
  const images = t.mock.method(pkMatchesRepository, "getArchivedPlayerAvatars", async () => ({ data: [] }));
  const call = t.mock.method(pkMatchesRepository, "getSeasonRatings", async () => ({ data: [
    { person_id: "a", person: { full_name: "An" }, rating: 1012.3, matches: 5, wins: 3, losses: 2, opponent_ids: ["b", "c", "d"] },
  ] }));
  assert.equal((await pkMatchesService.getLeaderboard(june, "doubles")).ranked.length, 12);
  assert.equal(call.mock.callCount(), 0);
  assert.equal(images.mock.callCount(), 1);
  const active = await pkMatchesService.getLeaderboard("current-period", "singles");
  assert.equal(call.mock.callCount(), 1);
  assert.equal(images.mock.callCount(), 1);
  assert.equal(active.ranked[0].points, 1012);
  assert.equal(active.ranked[0].rank, 1);
  assert.equal(active.archived, false);
  assert.equal(archivedPkLeaderboard("current-period", "singles"), null);
  assert.doesNotThrow(() => assertPkPeriodWritable("current-period"));
});

test("June avatar enrichment preserves every historical ranking field and never mutates the archive", async (t) => {
  const saved = archivedPkLeaderboard(june, "doubles");
  const first = saved.ranked[0];
  t.mock.method(pkMatchesRepository, "getArchivedPlayerAvatars", async (ids) => {
    assert.deepEqual(ids, saved.ranked.map((row) => row.id));
    return { data: [{ id: first.id, avatar_url: "https://example.test/avatar.jpg", rank: 999, points: 0, full_name: "Changed" }] };
  });
  const result = await pkMatchesService.getLeaderboard(june, "doubles");
  assert.deepEqual(result.ranked[0], { ...first, avatar_url: "https://example.test/avatar.jpg" });
  assert.deepEqual(result.ranked.slice(1), saved.ranked.slice(1));
  assert.deepEqual(archivedPkLeaderboard(june, "doubles"), saved);
});

test("a failed avatar lookup keeps the whole June table available with initials", async (t) => {
  const saved = archivedPkLeaderboard(june, "singles");
  const images = t.mock.method(pkMatchesRepository, "getArchivedPlayerAvatars", async () => ({ data: null, error: { message: "Unavailable" } }));
  assert.deepEqual(await pkMatchesService.getLeaderboard(june, "singles"), saved);
  images.mock.mockImplementation(async () => { throw new Error("Network unavailable"); });
  assert.deepEqual(await pkMatchesService.getLeaderboard(june, "singles"), saved);
});

test("all API mutations of June history fail before repository writes", async (t) => {
  t.mock.method(pkMatchesService, "getById", async () => ({ id: "old-match", period_id: june }));
  for (const method of ["create", "createMany", "update", "remove", "finalize", "correctCompleted", "voidResult"]) {
    t.mock.method(pkMatchesRepository, method, async () => { assert.fail(`Unexpected historical write: ${method}`); });
  }
  for (const action of [
    () => pkMatchesService.create({ period_id: june }, true),
    () => pkMatchesService.createBulk([{ period_id: june }], true),
    () => pkMatchesService.createBulk([{}], true, june),
    () => pkMatchesService.update("old-match", {}, true),
    () => pkMatchesService.finalize("old-match", {}, true),
    () => pkMatchesService.remove("old-match"),
    () => pkMatchesService.voidResult("old-match", "reason", {}),
  ]) await assert.rejects(action, /đã được lưu lịch sử/);
});
