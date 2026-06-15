import { supabase } from "../../config/supabase.js";

const MATCH_SELECT = `
  id, match_type, status, bet_items, winner_side, played_at, note, created_at, updated_at,
  challenger:people!pk_matches_challenger_id_fkey(id, full_name, nickname, avatar_url),
  challenger_partner:people!pk_matches_challenger_partner_id_fkey(id, full_name, nickname, avatar_url),
  opponent:people!pk_matches_opponent_id_fkey(id, full_name, nickname, avatar_url),
  opponent_partner:people!pk_matches_opponent_partner_id_fkey(id, full_name, nickname, avatar_url)
`;

export const pkMatchesRepository = {
  async getAll() {
    return supabase
      .from("pk_matches")
      .select(MATCH_SELECT)
      .order("created_at", { ascending: false });
  },

  async getByPerson(personId) {
    return supabase
      .from("pk_matches")
      .select(MATCH_SELECT)
      .or(
        `challenger_id.eq.${personId},opponent_id.eq.${personId},` +
        `challenger_partner_id.eq.${personId},opponent_partner_id.eq.${personId}`
      )
      .order("created_at", { ascending: false });
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

  async update(id, payload) {
    return supabase
      .from("pk_matches")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(MATCH_SELECT)
      .single();
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
