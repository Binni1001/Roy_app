import type {
  Notifications,
  NotificationItem,
  TournamentDetail,
  TournamentMatch,
  TournamentSummary,
  TournamentTeam,
} from "@roy/shared";
import { buildStandings } from "../domain/standings.ts";
import type { Member } from "./member.ts";

export interface TournamentData {
  summary: TournamentSummary;
  groupId: string;
  qualifiersPerGroup: number;
  teams: TournamentTeam[];
  groups: { id: string; name: string; teamIds: string[] }[];
  matches: TournamentMatch[];
}

export interface ExtrasStore {
  listNotifications(personId: string, limit: number): Promise<NotificationItem[]>;
  countUnreadNotifications(personId: string): Promise<number>;
  /** Giải của một nhóm, không gồm bản nháp, mới nhất trước. */
  listTournaments(groupId: string): Promise<TournamentSummary[]>;
  getTournament(id: string): Promise<TournamentData | null>;
}

export class NotFoundError extends Error {}

const KNOCKOUT_ORDER = ["quarterfinal", "semifinal", "third_place", "final"];

export async function loadNotifications(member: Member, store: ExtrasStore): Promise<Notifications> {
  const [items, unread] = await Promise.all([
    store.listNotifications(member.personId, 30),
    store.countUnreadNotifications(member.personId),
  ]);
  return { items, unread };
}

export async function loadTournament(
  member: Member,
  id: string,
  store: ExtrasStore,
): Promise<TournamentDetail> {
  const data = await store.getTournament(id);
  // Giải của nhóm khác và bản nháp được báo là không tồn tại, không lộ là có.
  if (!data || data.groupId !== member.groupId || data.summary.status === "draft") {
    throw new NotFoundError();
  }
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  return {
    ...data.summary,
    groups: data.groups.map((group) => {
      const matches = data.matches.filter(
        (match) => match.stage === "group" && match.groupId === group.id,
      );
      const teams = group.teamIds
        .map((teamId) => teamById.get(teamId))
        .filter((team): team is TournamentTeam => Boolean(team));
      return {
        id: group.id,
        name: group.name,
        standings: buildStandings(teams, matches, data.qualifiersPerGroup),
        matches,
      };
    }),
    knockout: data.matches
      .filter((match) => match.stage !== "group")
      .sort(
        (a, b) =>
          KNOCKOUT_ORDER.indexOf(a.stage) - KNOCKOUT_ORDER.indexOf(b.stage) ||
          (a.matchNumber ?? 0) - (b.matchNumber ?? 0),
      ),
  };
}
