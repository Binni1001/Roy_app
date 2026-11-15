/**
 * Bảng xếp hạng +3/−2 theo ĐÚNG định dạng bản cũ, để lưu vào pk_leaderboard_snapshots khi đóng kỳ.
 * Bản cũ vẫn đọc nguyên văn bảng đã lưu, nên từng trường và thứ tự phải giữ y hệt
 * backend/src/modules/pk-matches/pkPoints.js (buildFixedPkLeaderboard). Test so sánh trực tiếp với hàm cũ.
 */

export interface LegacyProfile {
  id?: string;
  full_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
}

/** Một dòng pk_matches như bản cũ đọc (MATCH_SELECT trong pkMatches.repository.js). */
export interface LegacyMatch {
  match_type: string;
  status: string;
  voided_at: string | null;
  winner_side: string | null;
  set_scores: { challenger: number; opponent: number }[] | null;
  challenger_id: string | null;
  challenger_partner_id: string | null;
  opponent_id: string | null;
  opponent_partner_id: string | null;
  challenger?: LegacyProfile | null;
  challenger_partner?: LegacyProfile | null;
  opponent?: LegacyProfile | null;
  opponent_partner?: LegacyProfile | null;
}

const DEFAULT_REQUIREMENTS = { min_matches: 1, min_opponents: 0 };

function tier(rank: number, total: number): string {
  if (rank === 1) return "champion";
  const percentile = ((rank - 1) / total) * 100;
  if (percentile <= 15) return "diamond";
  if (percentile <= 35) return "platinum";
  if (percentile <= 60) return "gold";
  if (percentile <= 85) return "silver";
  return "bronze";
}

type Key = "challenger" | "challenger_partner" | "opponent" | "opponent_partner";

interface Row {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_matches: number;
  score_for: number;
  score_against: number;
  points: number;
  score_difference: number;
  distinct_opponents: number;
  win_rate: number;
  matches_needed: number;
  opponents_needed: number;
  head_to_head_wins: number;
  head_to_head_losses: number;
  head_to_head_difference: number;
  head_to_head_applied: boolean;
  rank?: number;
  tier_key?: string;
  tied_rank?: boolean;
}

export function buildLegacyFixedBoard(matches: LegacyMatch[], matchType: string, requirements = DEFAULT_REQUIREMENTS) {
  const eligible = matches.filter(
    (m) =>
      m.match_type === matchType &&
      m.status === "completed" &&
      !m.voided_at &&
      ["challenger", "opponent"].includes(m.winner_side ?? ""),
  );
  const stats = new Map<string, Omit<Row, "points" | "score_difference" | "distinct_opponents" | "win_rate" | "matches_needed" | "opponents_needed" | "head_to_head_wins" | "head_to_head_losses" | "head_to_head_difference" | "head_to_head_applied"> & { opponents: Set<string> }>();
  const games: { sides: string[][]; winner: number }[] = [];
  for (const match of eligible) {
    const sides = (["challenger", "opponent"] as const).map((side) =>
      ([side, ...(matchType === "doubles" ? [`${side}_partner` as const] : [])] as Key[])
        .filter((key) => match[`${key}_id` as `${Key}_id`])
        .map((key) => ({ id: match[`${key}_id` as `${Key}_id`] as string, profile: (match[key] || {}) as LegacyProfile })),
    );
    if (
      sides.flat().length !== (matchType === "doubles" ? 4 : 2) ||
      new Set(sides.flat().map((p) => p.id)).size !== sides.flat().length
    ) {
      throw new Error("Người chơi trong trận không hợp lệ.");
    }
    const scores = match.set_scores;
    if (
      !Array.isArray(scores) ||
      !scores.length ||
      scores.some(
        (s) => !Number.isSafeInteger(s.challenger) || !Number.isSafeInteger(s.opponent) || s.challenger < 0 || s.opponent < 0 || s.challenger === s.opponent,
      )
    ) {
      throw new Error("Trận hoàn tất cần có tỷ số set hợp lệ để tính hiệu số.");
    }
    const totals = (["challenger", "opponent"] as const).map((side) => scores.reduce((sum, score) => sum + score[side], 0));
    const winner = match.winner_side === "challenger" ? 0 : 1;
    for (let side = 0; side < 2; side++) {
      for (const player of sides[side]) {
        if (!stats.has(player.id)) {
          stats.set(player.id, {
            id: player.id,
            full_name: player.profile.full_name || "Người chơi",
            nickname: player.profile.nickname || null,
            avatar_url: player.profile.avatar_url || null,
            wins: 0,
            losses: 0,
            total_matches: 0,
            score_for: 0,
            score_against: 0,
            opponents: new Set(),
          });
        }
        const row = stats.get(player.id)!;
        row.total_matches++;
        if (side === winner) row.wins++;
        else row.losses++;
        row.score_for += totals[side];
        row.score_against += totals[1 - side];
        for (const opponent of sides[1 - side]) row.opponents.add(opponent.id);
      }
    }
    games.push({ sides: sides.map((side) => side.map((p) => p.id)), winner });
  }
  const rows: Row[] = [...stats.values()].map(({ opponents, ...row }) => ({
    ...row,
    points: row.wins * 3 - row.losses * 2,
    score_difference: row.score_for - row.score_against,
    distinct_opponents: opponents.size,
    win_rate: Math.round((row.wins / row.total_matches) * 100),
    matches_needed: Math.max(0, requirements.min_matches - row.total_matches),
    opponents_needed: Math.max(0, requirements.min_opponents - opponents.size),
    head_to_head_wins: 0,
    head_to_head_losses: 0,
    head_to_head_difference: 0,
    head_to_head_applied: false,
  }));
  const ranked = rows.filter((r) => r.matches_needed === 0 && r.opponents_needed === 0);
  const groups = new Map<string, Row[]>();
  for (const row of ranked) {
    const key = `${row.points}:${row.score_difference}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((r) => r.id));
    const meetings = new Set<string>();
    for (const game of games) {
      for (let side = 0; side < 2; side++) {
        for (const id of game.sides[side].filter((x) => ids.has(x))) {
          const opponents = game.sides[1 - side].filter((x) => ids.has(x));
          if (!opponents.length) continue;
          for (const opponent of opponents) meetings.add([id, opponent].sort().join(":"));
          const row = group.find((r) => r.id === id)!;
          if (side === game.winner) row.head_to_head_wins++;
          else row.head_to_head_losses++;
        }
      }
    }
    const complete = meetings.size === (group.length * (group.length - 1)) / 2;
    for (const row of group) {
      row.head_to_head_applied = complete;
      row.head_to_head_difference = complete ? row.head_to_head_wins - row.head_to_head_losses : 0;
    }
  }
  ranked.sort(
    (a, b) =>
      b.points - a.points ||
      b.score_difference - a.score_difference ||
      b.head_to_head_difference - a.head_to_head_difference ||
      a.full_name.localeCompare(b.full_name, "vi") ||
      a.id.localeCompare(b.id),
  );
  for (let i = 0; i < ranked.length; i++) {
    const row = ranked[i];
    const previous = ranked[i - 1];
    const tied =
      previous &&
      row.points === previous.points &&
      row.score_difference === previous.score_difference &&
      row.head_to_head_difference === previous.head_to_head_difference;
    row.rank = tied ? previous.rank : i + 1;
    row.tier_key = tier(row.rank!, ranked.length);
  }
  const rankCounts = new Map<number, number>();
  for (const row of ranked) rankCounts.set(row.rank!, (rankCounts.get(row.rank!) || 0) + 1);
  for (const row of ranked) row.tied_rank = rankCounts.get(row.rank!)! > 1;
  return {
    scoring_method: "fixed_points",
    scoring_rule: "fixed_3_2_v1",
    archived: false,
    requirements,
    ranked,
    qualifying: rows
      .filter((r) => r.matches_needed > 0 || r.opponents_needed > 0)
      .sort((a, b) => b.total_matches - a.total_matches || a.full_name.localeCompare(b.full_name, "vi")),
  };
}
