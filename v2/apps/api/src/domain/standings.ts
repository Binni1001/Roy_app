import type { StandingRow, TournamentMatch, TournamentTeam } from "@roy/shared";

/**
 * Bảng xếp hạng vòng bảng của giải đôi: thắng 3 điểm.
 * Thứ tự: điểm, số trận thắng, hiệu số ván, hiệu số điểm cầu, đối đầu trực tiếp, hạt giống, tên.
 * Chuyển từ buildStandings trong backend/src/modules/tournaments/tournaments.service.js.
 */
export function buildStandings(
  teams: TournamentTeam[],
  matches: TournamentMatch[],
  qualifiers: number,
): StandingRow[] {
  const rows = new Map(
    teams.map((team) => [
      team.id,
      { team, played: 0, wins: 0, losses: 0, points: 0, setDifference: 0, pointDifference: 0 },
    ]),
  );
  const played = matches.filter(
    (match) => match.stage === "group" && match.status === "completed" && match.winnerTeamId,
  );

  for (const match of played) {
    const left = match.team1 && rows.get(match.team1.id);
    const right = match.team2 && rows.get(match.team2.id);
    if (!left || !right) continue;
    const sets = (match.team1Sets ?? 0) - (match.team2Sets ?? 0);
    const balls = (match.setScores ?? []).reduce((sum, s) => sum + (s.team1 - s.team2), 0);
    left.played += 1;
    right.played += 1;
    left.setDifference += sets;
    right.setDifference -= sets;
    left.pointDifference += balls;
    right.pointDifference -= balls;
    const [winner, loser] = match.winnerTeamId === left.team.id ? [left, right] : [right, left];
    winner.wins += 1;
    winner.points += 3;
    loser.losses += 1;
  }

  const headToHead = (a: string, b: string): number => {
    const direct = played.find(
      (match) =>
        (match.team1?.id === a && match.team2?.id === b) ||
        (match.team1?.id === b && match.team2?.id === a),
    );
    if (!direct) return 0;
    return direct.winnerTeamId === a ? -1 : 1;
  };

  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.setDifference - a.setDifference ||
      b.pointDifference - a.pointDifference ||
      headToHead(a.team.id, b.team.id) ||
      (a.team.seed ?? 9999) - (b.team.seed ?? 9999) ||
      a.team.name.localeCompare(b.team.name, "vi"),
  );

  return sorted.map((row, index) => ({ ...row, rank: index + 1, qualified: index < qualifiers }));
}
