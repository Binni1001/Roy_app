import type { Arena, ArenaMatch } from "@roy/shared";
import { buildLeaderboard } from "../domain/leaderboard.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import type { Member } from "./member.ts";

export const FIXED_POINTS_RULE = "fixed_3_2_v1";
export const PERIOD_MATCH_LIMIT = 60;

export interface ArenaStore extends BootstrapStore {
  getScoringRule(periodId: string): Promise<string | null>;
  /** Mọi kèo của một kỳ, mới nhất trước. */
  listPeriodMatches(periodId: string): Promise<ArenaMatch[]>;
}

export async function loadArena(member: Member, store: ArenaStore): Promise<Arena> {
  const empty = { supported: true, singles: [], doubles: [], myMatches: [], periodMatches: [], meId: member.personId };

  const period = await store.findOpenPeriod(member.groupId);
  if (!period) return { ...empty, period: null };

  const [rule, matches] = await Promise.all([
    store.getScoringRule(period.id),
    store.listPeriodMatches(period.id),
  ]);

  const myMatches = matches.filter(
    (match) =>
      match.status !== "cancelled" &&
      [...match.challengers, ...match.opponents].some((player) => player.id === member.personId),
  );

  // Cả câu lạc bộ xem được kèo của nhau, như bản cũ; kèo đã hủy thì ẩn.
  const periodMatches = matches.filter((match) => match.status !== "cancelled").slice(0, PERIOD_MATCH_LIMIT);

  // Kỳ dùng luật cũ (Elo, Wilson) không được tính lại bằng công thức mới.
  if (rule !== FIXED_POINTS_RULE) return { ...empty, period, supported: false, myMatches, periodMatches };

  return {
    period,
    supported: true,
    singles: buildLeaderboard(matches, "singles"),
    doubles: buildLeaderboard(matches, "doubles"),
    myMatches,
    periodMatches,
    meId: member.personId,
  };
}
