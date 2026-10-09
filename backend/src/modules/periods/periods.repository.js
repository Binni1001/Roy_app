import { supabase } from "../../config/supabase.js";

export const periodsRepository = {
  readiness: (id) => supabase.rpc("period_finance_readiness", { p_period_id: id }),
  checkOpen: (groupId, id = null) => supabase.rpc("assert_new_period_open", { p_group_id: groupId, p_exclude_id: id }),
  async getAll(groupIds = null) {
    if (Array.isArray(groupIds) && groupIds.length === 0) return { data: [], error: null };
    let query = supabase
      .from("periods")
      .select("*")
      .order("start_date", { ascending: false });
    if (groupIds !== null) query = query.in("group_id", groupIds);
    return await query;
  },

  async getById(id) {
    return await supabase
      .from("periods")
      .select("*")
      .eq("id", id)
      .single();
  },

  async getActiveGroupByEmail(email) {
    return await supabase
      .from("people")
      .select("active_group_id, group_id")
      .ilike("email", email)
      .maybeSingle();
  },

  async getGroupById(id) {
    return await supabase
      .from("groups")
      .select("id")
      .eq("id", id)
      .maybeSingle();
  },

  async getGroupsForOwnerFallback() {
    return await supabase
      .from("groups")
      .select("id")
      .limit(2);
  },

  async create(payload) {
    return await supabase
      .from("periods")
      .insert([payload])
      .select()
      .single();
  },

  async update(id, payload) {
    return await supabase
      .from("periods")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  }
};
