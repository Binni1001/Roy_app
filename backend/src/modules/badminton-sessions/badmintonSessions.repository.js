import { supabase } from "../../config/supabase.js";

export const badmintonSessionsRepository = {
  async getAll(groupIds) {
    if (groupIds !== null && !groupIds.length) return { data: [], error: null };
    let query = supabase
      .from("badminton_sessions")
      .select(`
        *,
        period:periods${groupIds === null ? "" : "!inner"}(id, group_id, name, start_date, end_date, status)
      `);
    if (groupIds !== null) query = query.in("period.group_id", groupIds);
    return await query.order("play_date", { ascending: false });
  },

  async getByPeriodId(periodId) {
    return await supabase
      .from("badminton_sessions")
      .select(`
        *,
        period:periods(id, name, start_date, end_date, status)
      `)
      .eq("period_id", periodId)
      .order("play_date", { ascending: false });
  },

  async getById(id) {
    return await supabase
      .from("badminton_sessions")
      .select(`
        *,
        period:periods(id, name, start_date, end_date, status)
      `)
      .eq("id", id)
      .single();
  },

  async create(payload) {
    return await supabase
      .from("badminton_sessions")
      .insert([payload])
      .select(`
        *,
        period:periods(id, name, start_date, end_date, status)
      `)
      .single();
  },

  async update(id, payload) {
    return await supabase
      .from("badminton_sessions")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        period:periods(id, name, start_date, end_date, status)
      `)
      .single();
  },

  async remove(id) {
    return await supabase
      .from("badminton_sessions")
      .delete()
      .eq("id", id)
      .select()
      .single();
  },

  async getPeriodById(periodId) {
    return await supabase
      .from("periods")
      .select("id, status, name")
      .eq("id", periodId)
      .single();
  }
};
