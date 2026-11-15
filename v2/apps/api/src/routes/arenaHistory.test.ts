import assert from "node:assert/strict";
import { test } from "node:test";
import { buildArenaHistory, type LeaderboardSnapshot } from "./arenaHistory.ts";

const snap = (over: Partial<LeaderboardSnapshot>): LeaderboardSnapshot => ({
  periodId: "k1",
  periodName: "Mua 5",
  startDate: "2026-10-10",
  matchType: "doubles",
  scoringRule: "fixed_3_2_v1",
  ranked: [],
  ...over,
});

test("singles and doubles of one period are grouped, newest period first", () => {
  const history = buildArenaHistory([
    snap({ periodId: "k1", ranked: [{ id: "a", rank: 1, points: 9, wins: 3, losses: 0, total_matches: 3, full_name: "An" }] }),
    snap({ periodId: "k1", matchType: "singles", ranked: [{ id: "b", rank: 1, points: 3, full_name: "Binh" }] }),
    snap({ periodId: "k0", periodName: "Thang 9", startDate: "2026-09-10", scoringRule: "elo_v1", ranked: [{ id: "c", rank: 1, points: 1512.6, full_name: "Chi" }] }),
  ]);
  assert.deepEqual(history.map((p) => p.periodName), ["Mua 5", "Thang 9"]);
  assert.equal(history[0].doubles[0].name, "An");
  assert.equal(history[0].singles[0].name, "Binh");
  assert.equal(history[1].scoringRule, "elo_v1");
  // Stored values are shown as saved: only rounded for display.
  assert.equal(history[1].doubles[0].points, 1513);
});

test("rows keep the saved rank order and prefer the nickname", () => {
  const [period] = buildArenaHistory([
    snap({
      ranked: [
        { id: "b", rank: 2, points: 4, full_name: "Binh", nickname: "Bi" },
        { id: "a", rank: 1, points: 9, full_name: "An", nickname: "" },
      ],
    }),
  ]);
  assert.deepEqual(period.doubles.map((r) => [r.rank, r.name]), [[1, "An"], [2, "Bi"]]);
});

test("periods with empty boards and malformed rows are dropped", () => {
  assert.deepEqual(buildArenaHistory([snap({ ranked: [] }), snap({ periodId: "k2", ranked: "oops" })]), []);
  const [period] = buildArenaHistory([snap({ ranked: [null, { rank: 1 }, { id: "a", rank: 1 }] })]);
  assert.deepEqual(period.doubles.map((r) => [r.id, r.name, r.points]), [["a", "Người chơi", 0]]);
});
