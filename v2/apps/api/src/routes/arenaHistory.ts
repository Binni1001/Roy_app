import type { ArenaHistoryPeriod, ArenaHistoryRow, MatchType } from "@roy/shared";

/** Một bảng xếp hạng đã lưu khi đóng kỳ. Đọc nguyên trạng, không bao giờ tính lại. */
export interface LeaderboardSnapshot {
  periodId: string;
  periodName: string;
  startDate: string;
  matchType: MatchType;
  scoringRule: string;
  ranked: unknown;
}

export interface ArenaHistoryStore {
  /** Bảng đã lưu của các kỳ thuộc một nhóm. */
  listLeaderboardSnapshots(groupId: string): Promise<LeaderboardSnapshot[]>;
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

function toRows(ranked: unknown): ArenaHistoryRow[] {
  if (!Array.isArray(ranked)) return [];
  const rows: ArenaHistoryRow[] = [];
  for (const item of ranked) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = text(row.id);
    if (!id) continue;
    rows.push({
      id,
      name: text(row.nickname) ?? text(row.full_name) ?? "Người chơi",
      avatarUrl: text(row.avatar_url),
      rank: num(row.rank),
      points: Math.round(num(row.points)),
      wins: num(row.wins),
      losses: num(row.losses),
      matches: num(row.total_matches),
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

/** Gom bảng đơn và đôi theo kỳ, kỳ mới nhất trước; bỏ kỳ không có ai trên bảng. */
export function buildArenaHistory(snapshots: LeaderboardSnapshot[]): ArenaHistoryPeriod[] {
  const periods = new Map<string, ArenaHistoryPeriod>();
  for (const snapshot of snapshots) {
    let period = periods.get(snapshot.periodId);
    if (!period) {
      period = {
        periodId: snapshot.periodId,
        periodName: snapshot.periodName,
        startDate: snapshot.startDate,
        scoringRule: snapshot.scoringRule,
        singles: [],
        doubles: [],
      };
      periods.set(snapshot.periodId, period);
    }
    period[snapshot.matchType === "singles" ? "singles" : "doubles"] = toRows(snapshot.ranked);
  }
  return [...periods.values()]
    .filter((period) => period.singles.length || period.doubles.length)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
