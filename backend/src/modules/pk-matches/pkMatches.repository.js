import { supabase } from "../../config/supabase.js";

const MATCH_SELECT = `
  id, match_type, status, bet_items, winner_side, played_at, note, sets, set_scores, created_at, updated_at, period_id,
  challenger_id, challenger_partner_id, opponent_id, opponent_partner_id,
  challenger:people!challenger_id(id, full_name, nickname, avatar_url),
  challenger_partner:people!challenger_partner_id(id, full_name, nickname, avatar_url),
  opponent:people!opponent_id(id, full_name, nickname, avatar_url),
  opponent_partner:people!opponent_partner_id(id, full_name, nickname, avatar_url)
`;

export const pkMatchesRepository = {
  async getAll(periodId) {
    let query = supabase
      .from("pk_matches")
      .select(MATCH_SELECT)
      .order("created_at", { ascending: false });
    if (periodId) query = query.eq("period_id", periodId);
    return query;
  },

  async getByPerson(personId, periodId) {
    let query = supabase
      .from("pk_matches")
      .select(MATCH_SELECT)
      .or(
        `challenger_id.eq.${personId},opponent_id.eq.${personId},` +
        `challenger_partner_id.eq.${personId},opponent_partner_id.eq.${personId}`
      )
      .order("created_at", { ascending: false });
    if (periodId) query = query.eq("period_id", periodId);
    return query;
  },

  async getById(id) {
    return supabase
      .from("pk_matches")
      .select(MATCH_SELECT)
      .eq("id", id)
      .single();
  },

  async create(payload) {
    return supabase
      .from("pk_matches")
      .insert([payload])
      .select(MATCH_SELECT)
      .single();
  },

  async createMany(payloads) {
    return supabase
      .from("pk_matches")
      .insert(payloads)
      .select(MATCH_SELECT);
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
    return supabase.from('pk_matches').delete().eq('id', id).select('id').single()
  },

  async getLeaderboard() {
    return supabase
      .from("pk_leaderboard")
      .select("*")
      .order("rank", { ascending: true });
  },

  async getPublicPeople() {
    return supabase
      .from("people")
      .select("id, full_name, nickname, phone, gender, bio, avatar_url, attendance_type")
      .eq("status", "active")
      .order("full_name", { ascending: true });
  },
};
