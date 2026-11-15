import type { AdminTournamentSummary, KnockoutStart } from "@roy/shared";
import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import type { AdminTournamentStore } from "./routes/adminTournaments.ts";

type Own = Omit<AdminTournamentStore, "findPerson" | "findOpenPeriod" | "getTournament" | "listGroupPlayers">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Hàm giải đấu của database báo lỗi bằng tiếng Việt có dấu: hiện thẳng cho owner. */
function tournamentError(error: { code?: string; message: string }): Error {
  if (["PGRST202", "42883"].includes(error.code ?? "")) {
    return new ActionError("Database chưa có hàm giải đấu (migration 20260821_doubles_tournaments.sql).", 503, "MIGRATION_NEEDED");
  }
  return new ActionError(error.message || "Không lưu được giải đấu.", 409, "TOURNAMENT_REFUSED");
}

const SETTINGS = "group_count, best_of, knockout_start, third_place_enabled";

/** Truy vấn cho màn hình Giải đấu của owner. Cấu hình, vòng trong và tỷ số gọi hàm database có sẵn. */
export const supabaseAdminTournaments: Own = {
  async listAdminTournaments(groupId) {
    const { data, error } = await db()
      .from("tournaments")
      .select(`id, name, status, start_date, end_date, ${SETTINGS}, champion:tournament_teams!champion_team_id(name), tournament_teams!tournament_teams_tournament_id_fkey(count)`)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (error) {
      // Tên khóa ngoại có thể khác: đọc lại không kèm phần đếm và tên vô địch.
      const plain = await db().from("tournaments").select(`id, name, status, start_date, end_date, ${SETTINGS}`).eq("group_id", groupId).order("created_at", { ascending: false });
      ensure(plain.error);
      return ((plain.data ?? []) as Record<string, unknown>[]).map((row) => toSummary(row, null, 0));
    }
    return ((data ?? []) as Record<string, unknown>[]).map((row) =>
      toSummary(row, (row.champion as { name?: string } | null)?.name ?? null, (row.tournament_teams as { count: number }[] | null)?.[0]?.count ?? 0),
    );
  },

  async getTournamentSettings(id) {
    const { data, error } = await db().from("tournaments").select(`description, ${SETTINGS}`).eq("id", id).maybeSingle();
    ensure(error);
    if (!data) return null;
    return {
      description: (data.description as string | null) ?? null,
      groupCount: Number(data.group_count),
      bestOf: Number(data.best_of),
      knockoutStart: data.knockout_start as KnockoutStart,
      thirdPlace: Boolean(data.third_place_enabled),
    };
  },

  async createTournament(groupId, input, actorEmail) {
    const { data, error } = await db()
      .from("tournaments")
      .insert({
        group_id: groupId,
        name: input.name,
        description: input.description,
        group_count: input.groupCount,
        knockout_start: input.knockoutStart,
        best_of: input.bestOf,
        third_place_enabled: input.thirdPlace,
        start_date: input.startDate,
        end_date: input.endDate,
        created_by_email: actorEmail,
      })
      .select("id")
      .single();
    if (error) throw tournamentError(error);
    return (data as { id: string }).id;
  },

  async setTournamentStatus(id, status) {
    const { error } = await db().from("tournaments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw tournamentError(error);
  },

  async deleteTournament(id) {
    const { error } = await db().from("tournaments").delete().eq("id", id);
    if (error) throw tournamentError(error);
  },

  async configureTournament(id, teams, settings, actorEmail) {
    const { error } = await db().rpc("configure_doubles_tournament", {
      p_tournament_id: id,
      p_teams: teams.map((t) => ({ name: t.name, seed: t.seed, group_index: t.groupIndex, member_ids: t.memberIds })),
      p_group_count: settings.groupCount,
      p_knockout_start: settings.knockoutStart,
      p_best_of: settings.bestOf,
      p_third_place_enabled: settings.thirdPlace,
      p_actor_email: actorEmail,
    });
    if (error) throw tournamentError(error);
  },

  async replaceKnockout(id, definitions, actorEmail) {
    const { error } = await db().rpc("replace_tournament_knockout", { p_tournament_id: id, p_matches: definitions, p_actor_email: actorEmail });
    if (error) throw tournamentError(error);
  },

  async getTournamentMatch(id) {
    const { data, error } = await db().from("tournament_matches").select("tournament_id, stage, status").eq("id", id).maybeSingle();
    ensure(error);
    return data ? { tournamentId: data.tournament_id as string, stage: data.stage as string, status: data.status as string } : null;
  },

  async saveTournamentMatch(id, status, setScores, actorEmail) {
    // Giữ nguyên đội, giờ, sân và ghi chú hiện có, như bản cũ (payload ?? match).
    const current = await db().from("tournament_matches").select("team1_id, team2_id, scheduled_at, court, note").eq("id", id).single();
    ensure(current.error);
    const row = current.data as { team1_id: string | null; team2_id: string | null; scheduled_at: string | null; court: string | null; note: string | null };
    const { error } = await db().rpc("save_tournament_match", {
      p_match_id: id,
      p_status: status,
      p_set_scores: setScores,
      p_team1_id: row.team1_id,
      p_team2_id: row.team2_id,
      p_scheduled_at: row.scheduled_at,
      p_court: row.court,
      p_note: row.note,
      p_actor_email: actorEmail,
    });
    if (error) throw tournamentError(error);
  },
};

function toSummary(row: Record<string, unknown>, championName: string | null, teamCount: number): AdminTournamentSummary {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    championName,
    groupCount: Number(row.group_count),
    bestOf: Number(row.best_of),
    knockoutStart: row.knockout_start as KnockoutStart,
    thirdPlace: Boolean(row.third_place_enabled),
    teamCount,
  };
}
