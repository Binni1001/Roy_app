import assert from "node:assert/strict";
import { test } from "node:test";
import type { ArenaMatch, ArenaPlayer } from "@roy/shared";
import { buildLeaderboard } from "./leaderboard.ts";

const p = (id: string): ArenaPlayer => ({ id, name: id.toUpperCase(), avatarUrl: null });

let seq = 0;
function single(winner: string, loser: string, scores: [number, number][] = [[21, 15]]): ArenaMatch {
  return {
    id: `m${++seq}`,
    type: "singles",
    status: "completed",
    playedAt: "2026-11-12T11:00:00Z",
    sets: scores.length,
    challengers: [p(winner)],
    opponents: [p(loser)],
    winnerSide: "challenger",
    setScores: scores.map(([challenger, opponent]) => ({ challenger, opponent })),
    voided: false,
  };
}

const summary = (matches: ArenaMatch[], type: "singles" | "doubles" = "singles") =>
  buildLeaderboard(matches, type).map((r) => `${r.rank}${r.tied ? "=" : ""} ${r.id} ${r.points} ${r.scoreDifference}`);

test("a win is +3 and a loss is -2, negative totals allowed", () => {
  assert.deepEqual(summary([single("a", "b"), single("a", "b")]), ["1 a 6 12", "2 b -4 -12"]);
});

test("score difference breaks equal points", () => {
  // a and b both have one win and one loss (1 point); a won by more.
  const matches = [single("a", "c", [[21, 5]]), single("c", "a", [[21, 19]]), single("b", "c", [[21, 19]]), single("c", "b", [[21, 19]])];
  const rows = summary(matches);
  assert.equal(rows[0], "1 c 2 -14");
  assert.equal(rows[1], "2 a 1 14");
  assert.equal(rows[2], "3 b 1 0");
});

test("head-to-head decides a tie only when the tied players have met", () => {
  // a and b: one win, one loss each, same score difference; a beat b directly.
  const met = [single("a", "b", [[21, 19]]), single("c", "a", [[21, 19]]), single("b", "c", [[21, 19]])];
  // All three are 1 point, difference 0, and every pair met once: a>b, c>a, b>c — a full cycle stays tied.
  assert.deepEqual(summary(met), ["1= a 1 0", "1= b 1 0", "1= c 1 0"]);

  // a beat b, and both drew level through other opponents: a wins the tie.
  const decided = [
    single("a", "b", [[21, 19]]),
    single("x", "a", [[21, 19]]),
    single("b", "y", [[21, 19]]),
  ];
  const rows = summary(decided).filter((line) => / [ab] /.test(line));
  assert.deepEqual(rows, ["2 a 1 0", "3 b 1 0"]);
});

test("players who never met stay tied on the same rank", () => {
  const rows = summary([single("a", "x", [[21, 19]]), single("b", "y", [[21, 19]])]);
  assert.deepEqual(rows, ["1= a 3 2", "1= b 3 2", "3= x -2 -2", "3= y -2 -2"]);
});

test("voided, unfinished and wrong-type matches are ignored", () => {
  const voided = { ...single("a", "b"), voided: true };
  const pending = { ...single("a", "b"), status: "pending" };
  const noScore = { ...single("a", "b"), setScores: null };
  assert.deepEqual(summary([voided, pending, noScore]), []);
  assert.deepEqual(summary([single("a", "b")], "doubles"), []);
});

test("doubles points belong to each person, not to the pair", () => {
  const match: ArenaMatch = {
    ...single("a", "c"),
    type: "doubles",
    challengers: [p("a"), p("b")],
    opponents: [p("c"), p("d")],
  };
  const rows = buildLeaderboard([match], "doubles");
  assert.deepEqual(rows.map((r) => [r.id, r.points, r.rank]), [["a", 3, 1], ["b", 3, 1], ["c", -2, 3], ["d", -2, 3]]);
  assert.equal(rows[0].tier, "champion");
});
