import type { TournamentMatch, TournamentSetScore, TournamentSummary, TournamentTeam } from "@roy/shared";
import { db } from "./db.ts";
import type { ArenaHistoryStore } from "./routes/arenaHistory.ts";
import type { ExtrasStore, TournamentData } from "./routes/extras.ts";

type Result<T> = { data: T | null; error: { message: string } | null };

function rows<T>(result: Result<unknown>): T[] {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T[];
}

interface TournamentRow {
  id: string;
  group_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  qualifiers_per_group: number;
  champion_team_id: string | null;
}

const TOURNAMENT = "id, group_id, name, status, start_date, end_date, qualifiers_per_group, champion_team_id";

function summary(row: TournamentRow, championName: string | null): TournamentSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    championName,
  };
}

/** Truy vấn Supabase cho thông báo và giải đấu. Không chứa logic nghiệp vụ. */
export const supabaseExtras: ExtrasStore & ArenaHistoryStore = {
  async listNotifications(personId, limit) {
    const data = rows<{ id: string; kind: string; title: string; body: string | null; read: boolean; created_at: string }>(
      await db()
        .from("notifications")
        .select("id, kind, title, body, read, created_at")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return data.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.created_at,
    }));
  },

  async countUnreadNotifications(personId) {
    const { count, error } = await db()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async listTournaments(groupId) {
    const data = rows<TournamentRow>(
      await db()
        .from("tournaments")
        .select(TOURNAMENT)
        .eq("group_id", groupId)
        .neq("status", "draft")
        .order("created_at", { ascending: false }),
    );
    const championIds = data.map((row) => row.champion_team_id).filter((id): id is string => Boolean(id));
    const champions = championIds.length
      ? rows<{ id: string; name: string }>(
          await db().from("tournament_teams").select("id, name").in("id", championIds),
        )
      : [];
    const nameById = new Map(champions.map((team) => [team.id, team.name]));
    return data.map((row) => summary(row, nameById.get(row.champion_team_id ?? "") ?? null));
  },

  async getTournament(id) {
    const base = rows<TournamentRow>(await db().from("tournaments").select(TOURNAMENT).eq("id", id).limit(1))[0];
    if (!base) return null;

    const [teamRows, memberRows, groupRows, placementRows, matchRows] = await Promise.all([
      db().from("tournament_teams").select("id, name, seed").eq("tournament_id", id),
      db()
        .from("tournament_team_members")
        .select("team_id, member_slot, person:people!person_id(full_name, nickname)")
        .eq("tournament_id", id)
        .order("member_slot", { ascending: true }),
      db().from("tournament_groups").select("id, name, position").eq("tournament_id", id).order("position"),
      db().from("tournament_group_teams").select("group_id, team_id, position").eq("tournament_id", id).order("position"),
      db()
        .from("tournament_matches")
        .select(
          "id, stage, group_id, bracket_key, match_number, status, team1_id, team2_id, team1_source, team2_source, " +
            "team1_sets, team2_sets, set_scores, winner_team_id",
        )
        .eq("tournament_id", id)
        .order("match_number", { ascending: true }),
    ]);

    const members = rows<{ team_id: string; person: { full_name: string; nickname: string | null } | null }>(memberRows);
    const teams: TournamentTeam[] = rows<{ id: string; name: string; seed: number | null }>(teamRows).map((team) => ({
      id: team.id,
      name: team.name,
      seed: team.seed,
      players: members
        .filter((member) => member.team_id === team.id && member.person)
        .map((member) => member.person!.nickname || member.person!.full_name),
    }));
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const placements = rows<{ group_id: string; team_id: string }>(placementRows);

    const matches: TournamentMatch[] = rows<{
      id: string;
      stage: string;
      group_id: string | null;
      bracket_key: string | null;
      match_number: number | null;
      status: string;
      team1_id: string | null;
      team2_id: string | null;
      team1_source: string | null;
      team2_source: string | null;
      team1_sets: number | null;
      team2_sets: number | null;
      set_scores: TournamentSetScore[] | null;
      winner_team_id: string | null;
    }>(matchRows).map((row) => ({
      id: row.id,
      stage: row.stage,
      groupId: row.group_id,
      bracketKey: row.bracket_key,
      matchNumber: row.match_number,
      status: row.status,
      team1: teamById.get(row.team1_id ?? "") ?? null,
      team2: teamById.get(row.team2_id ?? "") ?? null,
      team1Source: row.team1_source,
      team2Source: row.team2_source,
      team1Sets: row.team1_sets,
      team2Sets: row.team2_sets,
      setScores: row.set_scores,
      winnerTeamId: row.winner_team_id,
    }));

    const data: TournamentData = {
      summary: summary(base, teamById.get(base.champion_team_id ?? "")?.name ?? null),
      groupId: base.group_id,
      qualifiersPerGroup: base.qualifiers_per_group,
      teams,
      groups: rows<{ id: string; name: string }>(groupRows).map((group) => ({
        id: group.id,
        name: group.name,
        teamIds: placements.filter((p) => p.group_id === group.id).map((p) => p.team_id),
      })),
      matches,
    };
    return data;
  },

  async listLeaderboardSnapshots(groupId) {
    const data = rows<{
      period_id: string;
      match_type: "singles" | "doubles";
      scoring_rule: string;
      result: { ranked?: unknown } | null;
      period: { name: string; start_date: string };
    }>(
      await db()
        .from("pk_leaderboard_snapshots")
        .select("period_id, match_type, scoring_rule, result, period:periods!inner(name, start_date, group_id)")
        .eq("period.group_id", groupId),
    );
    return data.map((row) => ({
      periodId: row.period_id,
      periodName: row.period.name,
      startDate: row.period.start_date,
      matchType: row.match_type,
      scoringRule: row.scoring_rule,
      ranked: row.result?.ranked,
    }));
  },
};
