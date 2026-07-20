import assert from "node:assert/strict";
import test from "node:test";
import { buildSeasonAchievements } from "../src/modules/pk-matches/pkAchievements.js";

const people = {
  a: { id: "a", full_name: "An" },
  b: { id: "b", full_name: "Bình" },
  c: { id: "c", full_name: "Chi" },
  d: { id: "d", full_name: "Dũng" },
};

function completedMatch(number, {
  challenger = "a",
  opponent = "b",
  challengerPartner = null,
  opponentPartner = null,
  winner = "challenger",
  date = "2026-07-10",
  status = "completed",
  voidedAt = null,
} = {}) {
  return {
    id: `match-${number}`,
    match_number: number,
    match_type: challengerPartner ? "doubles" : "singles",
    status,
    winner_side: winner,
    played_at: `${date}T12:00:00.000Z`,
    voided_at: voidedAt,
    challenger_id: challenger,
    challenger: people[challenger],
    challenger_partner_id: challengerPartner,
    challenger_partner: challengerPartner ? people[challengerPartner] : null,
    opponent_id: opponent,
    opponent: people[opponent],
    opponent_partner_id: opponentPartner,
    opponent_partner: opponentPartner ? people[opponentPartner] : null,
  };
}

test("awards energetic and most-played honors from valid season matches", () => {
  const opponents = ["b", "c", "d", "b", "c", "d", "b", "c"];
  const dates = ["2026-07-10", "2026-07-10", "2026-07-11", "2026-07-11", "2026-07-12", "2026-07-12", "2026-07-12", "2026-07-12"];
  const result = buildSeasonAchievements(opponents.map((opponent, index) =>
    completedMatch(index + 1, { opponent, date: dates[index] })
  ));

  assert.deepEqual(result.energetic.map((player) => player.id), ["a"]);
  assert.equal(result.by_person.a.total_matches, 8);
  assert.equal(result.by_person.a.play_days, 3);
  assert.equal(result.by_person.a.energetic, true);
  assert.deepEqual(result.most_played.players.map((player) => player.id), ["a"]);
  assert.equal(result.most_played.count, 8);
});

test("calculates the current winning streak in match-number order", () => {
  const shuffled = [
    completedMatch(5),
    completedMatch(1),
    completedMatch(4),
    completedMatch(2, { winner: "opponent" }),
    completedMatch(3),
  ];
  const result = buildSeasonAchievements(shuffled);

  assert.equal(result.by_person.a.current_streak, 3);
  assert.equal(result.by_person.a.best_streak, 3);
  assert.equal(result.winning_streak.count, 3);
  assert.deepEqual(result.winning_streak.players.map((player) => player.id), ["a"]);
});

test("counts all four doubles players and keeps most-played ties", () => {
  const result = buildSeasonAchievements([
    completedMatch(1, { challengerPartner: "b", opponent: "c", opponentPartner: "d" }),
  ]);

  assert.deepEqual(Object.keys(result.by_person).sort(), ["a", "b", "c", "d"]);
  assert.equal(result.by_person.a.wins, undefined);
  assert.equal(result.by_person.a.total_matches, 1);
  assert.deepEqual(result.most_played.players.map((player) => player.id).sort(), ["a", "b", "c", "d"]);
});

test("ignores pending, cancelled, incomplete and voided matches", () => {
  const result = buildSeasonAchievements([
    completedMatch(1, { status: "pending" }),
    completedMatch(2, { status: "cancelled" }),
    { ...completedMatch(3), winner_side: null },
    completedMatch(4, { voidedAt: "2026-07-20T12:00:00.000Z" }),
  ]);

  assert.deepEqual(result.energetic, []);
  assert.deepEqual(result.by_person, {});
  assert.equal(result.winning_streak.count, 0);
  assert.equal(result.most_played.count, 0);
});
