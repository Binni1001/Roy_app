import { supabase } from "../../config/supabase.js";

const MATCH_SELECT = `
  id, match_number, match_type, status, bet_items, winner_side, played_at, note,
  sets, set_scores, created_at, updated_at, completed_at, rating_locked_at,
  voided_at, voided_by_email, void_reason, period_id,
  challenger_id, challenger_partner_id, opponent_id, opponent_partner_id,
  challenger:people!challenger_id(id, full_name, nickname, avatar_url),
  challenger_partner:people!challenger_partner_id(id, full_name, nickname, avatar_url),
  opponent:people!opponent_id(id, full_name, nickname, avatar_url),
  opponent_partner:people!opponent_partner_id(id, full_name, nickname, avatar_url)
`;

function orderMatches(query) {
  return query
    .order("match_number", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
}

export const pkMatchesRepository = {
  getScoringRule: (periodId) => supabase.from("periods").select("id,status,pk_scoring_rule").eq("id", periodId).single(),
  getSnapshot: (periodId, matchType) => supabase.from("pk_leaderboard_snapshots").select("result,saved_at")
    .eq("period_id", periodId).eq("match_type", matchType).maybeSingle(),
  sourceSignature: (periodId) => supabase.rpc("pk_ranking_source_signature", { p_period_id: periodId }),
  async getRankingMatches(periodId) {
    const rows = [];
    for (let start = 0; ; start += 1000) {
      const result = await supabase.from("pk_matches").select(MATCH_SELECT).eq("period_id", periodId)
        .eq("status", "completed").is("voided_at", null).order("id").range(start, start + 999);
      if (result.error) return result;
      rows.push(...result.data);
      if (result.data.length < 1000) return { data: rows, error: null };
    }
  },
  async getAll(periodId) {
    let query = supabase.from("pk_matches").select(MATCH_SELECT);
    if (periodId) query = query.eq("period_id", periodId);
    return orderMatches(query);
  },

  async getByPerson(personId, periodId) {
    let query = supabase
      .from("pk_matches")
      .select(MATCH_SELECT)
      .or(
        `challenger_id.eq.${personId},opponent_id.eq.${personId},` +
        `challenger_partner_id.eq.${personId},opponent_partner_id.eq.${personId}`
      );
    if (periodId) query = query.eq("period_id", periodId);
    return orderMatches(query);
  },

  async getById(id) {
    return supabase.from("pk_matches").select(MATCH_SELECT).eq("id", id).single();
  },

  async getPersonByEmail(email) {
    return supabase
      .from("people")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
  },

  async create(payload) {
    return supabase.from("pk_matches").insert([payload]).select(MATCH_SELECT).single();
  },

  async createMany(payloads) {
    return supabase.from("pk_matches").insert(payloads).select(MATCH_SELECT);
  },

  async update(id, payload) {
    return supabase
      .from("pk_matches")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(MATCH_SELECT)
      .single();
  },

  async remove(id) {
    return supabase.from("pk_matches").delete().eq("id", id).select("id").single();
  },

  async finalize(id, winnerSide, setScores, actorEmail) {
    return supabase.rpc("finalize_pk_match", {
      p_match_id: id,
      p_winner_side: winnerSide,
      p_set_scores: setScores,
      p_actor_email: actorEmail || null,
    });
  },

  async voidResult(id, reason, actorEmail) {
    return supabase.rpc("void_pk_match", {
      p_match_id: id,
      p_reason: reason,
      p_actor_email: actorEmail || null,
    });
  },

  async correctCompleted(id, payload, actorEmail) {
    return supabase.rpc("correct_completed_pk_match", {
      p_match_id: id,
      p_match_type: payload.match_type,
      p_challenger_id: payload.challenger_id,
      p_opponent_id: payload.opponent_id,
      p_challenger_partner_id: payload.challenger_partner_id || null,
      p_opponent_partner_id: payload.opponent_partner_id || null,
      p_sets: payload.sets,
      p_played_at: payload.played_at || null,
      p_bet_items: payload.bet_items || null,
      p_note: payload.note || null,
      p_actor_email: actorEmail || null,
    });
  },
  correctResult: (id, payload, actorEmail) => supabase.rpc("correct_pk_match_result", {
    p_match_id: id, p_winner_side: payload.winner_side, p_set_scores: payload.set_scores,
    p_expected_updated_at: payload.expected_updated_at, p_actor_email: actorEmail || null,
  }),

  async getSeasonRatings(periodId, matchType) {
    return supabase
      .from("pk_season_ratings")
      .select(`
        person_id, rating, matches, wins, losses, opponent_ids, last_match_number,
        person:people!person_id(id, full_name, nickname, avatar_url, attendance_type)
      `)
      .eq("period_id", periodId)
      .eq("match_type", matchType);
  },

  async getArchivedPlayerAvatars(personIds) {
    // Historical players still need their image even if they are now inactive.
    return supabase.from("people").select("id, avatar_url").in("id", personIds);
  },

  async getPublicPeople() {
    return supabase
      .from("people")
      .select("id, full_name, nickname, phone, gender, bio, avatar_url, attendance_type, email, status")
      .eq("status", "active")
      .order("full_name", { ascending: true });
  },
};
