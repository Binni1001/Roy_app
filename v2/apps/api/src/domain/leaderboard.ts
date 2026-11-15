import type { ArenaMatch, LeaderboardRow, MatchType, Tier } from "@roy/shared";

/**
 * Bảng xếp hạng theo luật fixed_3_2_v1: thắng +3, thua -2, cho phép điểm âm.
 * Xếp theo điểm, rồi hiệu số điểm cầu, rồi đối đầu trong nhóm còn hòa.
 * Chuyển từ backend/src/modules/pk-matches/pkPoints.js, giữ nguyên cách tính.
 */

function tierOf(rank: number, total: number): Tier {
  if (rank === 1) return "champion";
  const percentile = ((rank - 1) / total) * 100;
  if (percentile <= 15) return "diamond";
  if (percentile <= 35) return "platinum";
  if (percentile <= 60) return "gold";
  if (percentile <= 85) return "silver";
  return "bronze";
}

/** Trận được tính điểm: đã hoàn tất, chưa hủy kết quả, có bên thắng và tỷ số hợp lệ. */
export function countsForRanking(match: ArenaMatch): boolean {
  if (match.status !== "completed" || match.voided || !match.winnerSide) return false;
  const size = match.type === "doubles" ? 2 : 1;
  const ids = [...match.challengers, ...match.opponents].map((player) => player.id);
  if (match.challengers.length !== size || match.opponents.length !== size) return false;
  if (new Set(ids).size !== ids.length) return false;
  const scores = match.setScores;
  return (
    Array.isArray(scores) &&
    scores.length > 0 &&
    scores.every(
      (s) =>
        Number.isSafeInteger(s.challenger) &&
        Number.isSafeInteger(s.opponent) &&
        s.challenger >= 0 &&
        s.opponent >= 0 &&
        s.challenger !== s.opponent,
    )
  );
}

interface Working extends Omit<LeaderboardRow, "rank" | "tied" | "tier"> {
  h2hWins: number;
  h2hLosses: number;
  h2hDifference: number;
}

export function buildLeaderboard(matches: ArenaMatch[], type: MatchType): LeaderboardRow[] {
  const stats = new Map<string, Working>();
  const games: { sides: [string[], string[]]; winner: 0 | 1 }[] = [];

  for (const match of matches) {
    if (match.type !== type || !countsForRanking(match)) continue;
    const sides = [match.challengers, match.opponents] as const;
    const totals = [
      match.setScores!.reduce((sum, s) => sum + s.challenger, 0),
      match.setScores!.reduce((sum, s) => sum + s.opponent, 0),
    ];
    const winner = match.winnerSide === "challenger" ? 0 : 1;

    for (const side of [0, 1] as const) {
      for (const player of sides[side]) {
        let row = stats.get(player.id);
        if (!row) {
          row = {
            ...player,
            points: 0,
            wins: 0,
            losses: 0,
            matches: 0,
            scoreDifference: 0,
            h2hWins: 0,
            h2hLosses: 0,
            h2hDifference: 0,
          };
          stats.set(player.id, row);
        }
        row.matches += 1;
        if (side === winner) row.wins += 1;
        else row.losses += 1;
        row.scoreDifference += totals[side] - totals[1 - side];
      }
    }
    games.push({
      sides: [sides[0].map((p) => p.id), sides[1].map((p) => p.id)],
      winner,
    });
  }

  const rows = [...stats.values()];
  for (const row of rows) row.points = row.wins * 3 - row.losses * 2;

  // Đối đầu chỉ phân định khi mọi cặp trong nhóm hòa đã gặp nhau ở hai bên đối diện.
  const groups = new Map<string, Working[]>();
  for (const row of rows) {
    const key = `${row.points}:${row.scoreDifference}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((row) => row.id));
    const meetings = new Set<string>();
    for (const game of games) {
      for (const side of [0, 1] as const) {
        const opponents = game.sides[1 - side].filter((id) => ids.has(id));
        if (!opponents.length) continue;
        for (const id of game.sides[side].filter((x) => ids.has(x))) {
          for (const opponent of opponents) meetings.add([id, opponent].sort().join(":"));
          const row = group.find((r) => r.id === id)!;
          if (side === game.winner) row.h2hWins += 1;
          else row.h2hLosses += 1;
        }
      }
    }
    const complete = meetings.size === (group.length * (group.length - 1)) / 2;
    for (const row of group) row.h2hDifference = complete ? row.h2hWins - row.h2hLosses : 0;
  }

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.scoreDifference - a.scoreDifference ||
      b.h2hDifference - a.h2hDifference ||
      a.name.localeCompare(b.name, "vi") ||
      a.id.localeCompare(b.id),
  );

  const ranks: number[] = [];
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const tied =
      previous &&
      row.points === previous.points &&
      row.scoreDifference === previous.scoreDifference &&
      row.h2hDifference === previous.h2hDifference;
    ranks.push(tied ? ranks[index - 1] : index + 1);
  });

  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarUrl,
    rank: ranks[index],
    tied: ranks.filter((rank) => rank === ranks[index]).length > 1,
    tier: tierOf(ranks[index], rows.length),
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    matches: row.matches,
    scoreDifference: row.scoreDifference,
  }));
}
