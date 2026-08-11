import { supabase } from "../../config/supabase.js";

export const periodsRepository = {
  async getAll() {
    return await supabase
      .from("periods")
      .select("*")
      .order("start_date", { ascending: false });
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
