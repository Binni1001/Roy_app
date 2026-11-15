import assert from "node:assert/strict";
import { test } from "node:test";
import type { TournamentMatch, TournamentTeam } from "@roy/shared";
import { buildStandings } from "./standings.ts";

const team = (id: string, seed: number): TournamentTeam => ({ id, name: id.toUpperCase(), seed, players: [] });
const teams = [team("a", 1), team("b", 2), team("c", 3), team("d", 4)];
const byId = new Map(teams.map((t) => [t.id, t]));

function game(winner: string, loser: string, score: [number, number] = [21, 15]): TournamentMatch {
  return {
    id: `${winner}${loser}`,
    stage: "group",
    groupId: "g",
    bracketKey: null,
    matchNumber: null,
    status: "completed",
    team1: byId.get(winner)!,
    team2: byId.get(loser)!,
    team1Source: null,
    team2Source: null,
    team1Sets: 1,
    team2Sets: 0,
    setScores: [{ team1: score[0], team2: score[1] }],
    winnerTeamId: winner,
  };
}

const order = (matches: TournamentMatch[], qualifiers = 2) =>
  buildStandings(teams, matches, qualifiers).map((r) => `${r.rank} ${r.team.id} ${r.points}${r.qualified ? " Q" : ""}`);

test("a win is worth 3 points and the top teams qualify", () => {
  const rows = order([game("a", "b"), game("a", "c"), game("a", "d"), game("b", "c"), game("b", "d"), game("c", "d")]);
  assert.deepEqual(rows, ["1 a 9 Q", "2 b 6 Q", "3 c 3", "4 d 0"]);
});

test("point difference separates teams level on points, wins and sets", () => {
  // a, b and c each win once in a cycle; a wins big, so a leads on point difference.
  const rows = buildStandings(teams.slice(0, 3), [game("a", "b", [21, 10]), game("b", "c", [21, 19]), game("c", "a", [21, 20])], 2);
  assert.deepEqual(rows.map((r) => [r.team.id, r.pointDifference]), [["a", 10], ["c", -1], ["b", -9]]);
});

test("head-to-head separates two teams level on everything else", () => {
  // a and b: two wins, one loss, +2 point difference each. b beat a directly.
  const matches = [
    game("b", "a", [21, 19]),
    game("a", "c", [21, 19]),
    game("a", "d", [21, 19]),
    game("b", "c", [21, 19]),
    game("d", "b", [21, 19]),
  ];
  const rows = buildStandings(teams, matches, 2);
  assert.deepEqual(rows.map((r) => r.team.id), ["b", "a", "d", "c"]);
  assert.equal(rows[0].pointDifference, rows[1].pointDifference);
});

test("unfinished and knockout matches do not count", () => {
  const pending = { ...game("a", "b"), status: "pending" };
  const final = { ...game("a", "b"), stage: "final" };
  const rows = buildStandings(teams, [pending, final], 2);
  assert.ok(rows.every((r) => r.played === 0 && r.points === 0));
  // With nothing played, seeds decide the display order.
  assert.deepEqual(rows.map((r) => r.team.id), ["a", "b", "c", "d"]);
});
