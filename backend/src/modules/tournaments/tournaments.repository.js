import { supabase } from "../../config/supabase.js";

const TOURNAMENT_FIELDS = `
  id, group_id, name, description, status, group_count, qualifiers_per_group,
  knockout_start, best_of, points_for_win, third_place_enabled,
  start_date, end_date, champion_team_id, created_by_email, created_at, updated_at
`;

export const tournamentsRepository = {
  async list(groupId, includeDraft = false) {
    let query = supabase
      .from("tournaments")
      .select(TOURNAMENT_FIELDS)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (!includeDraft) query = query.neq("status", "draft");
    return query;
  },

  async getBase(id) {
    return supabase
      .from("tournaments")
      .select(TOURNAMENT_FIELDS)
      .eq("id", id)
      .maybeSingle();
  },

  async getTeams(tournamentId) {
    return supabase
      .from("tournament_teams")
      .select("id, tournament_id, name, seed, status, created_at, updated_at")
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  },

  async getTeamMembers(tournamentId) {
    return supabase
      .from("tournament_team_members")
      .select(`
        id, tournament_id, team_id, person_id, member_slot,
        person:people!person_id(id, full_name, nickname, avatar_url, status)
      `)
      .eq("tournament_id", tournamentId)
      .order("member_slot", { ascending: true });
  },

  async getGroups(tournamentId) {
    return supabase
      .from("tournament_groups")
      .select("id, tournament_id, code, name, position")
      .eq("tournament_id", tournamentId)
      .order("position", { ascending: true });
  },

  async getGroupTeams(tournamentId) {
    return supabase
      .from("tournament_group_teams")
      .select("tournament_id, group_id, team_id, position")
      .eq("tournament_id", tournamentId)
      .order("position", { ascending: true });
  },

  async getMatches(tournamentId) {
    return supabase
      .from("tournament_matches")
      .select(`
        id, tournament_id, group_id, stage, bracket_key, bracket_position,
        match_number, team1_id, team2_id, team1_source, team2_source,
        status, set_scores, team1_sets, team2_sets, winner_team_id,
        next_match_id, next_slot, loser_next_match_id, loser_next_slot,
        scheduled_at, court, note, completed_at, created_at, updated_at
      `)
      .eq("tournament_id", tournamentId)
      .order("match_number", { ascending: true });
  },

  async getMatch(id) {
    return supabase
      .from("tournament_matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
  },

  async create(payload) {
    return supabase
      .from("tournaments")
      .insert([payload])
      .select(TOURNAMENT_FIELDS)
      .single();
  },

  async update(id, payload) {
    return supabase
      .from("tournaments")
      .update(payload)
      .eq("id", id)
      .select(TOURNAMENT_FIELDS)
      .single();
  },

  async remove(id) {
    return supabase.from("tournaments").delete().eq("id", id).select("id").single();
  },

  async configure(id, payload, actorEmail) {
    return supabase.rpc("configure_doubles_tournament", {
      p_tournament_id: id,
      p_teams: payload.teams,
      p_group_count: payload.group_count,
      p_knockout_start: payload.knockout_start,
      p_best_of: payload.best_of,
      p_third_place_enabled: payload.third_place_enabled,
      p_actor_email: actorEmail || null,
    });
  },

  async replaceKnockout(id, matches, actorEmail) {
    return supabase.rpc("replace_tournament_knockout", {
      p_tournament_id: id,
      p_matches: matches,
      p_actor_email: actorEmail || null,
    });
  },

  async saveMatch(id, payload, actorEmail) {
    return supabase.rpc("save_tournament_match", {
      p_match_id: id,
      p_status: payload.status,
      p_set_scores: payload.set_scores || [],
      p_team1_id: payload.team1_id || null,
      p_team2_id: payload.team2_id || null,
      p_scheduled_at: payload.scheduled_at || null,
      p_court: payload.court || null,
      p_note: payload.note || null,
      p_actor_email: actorEmail || null,
    });
  },

  async reorderGroupMatches(tournamentId, groupId, matchIds, actorEmail) {
    return supabase.rpc("reorder_tournament_group_matches", {
      p_tournament_id: tournamentId,
      p_group_id: groupId,
      p_match_ids: matchIds,
      p_actor_email: actorEmail || null,
    });
  },
};
