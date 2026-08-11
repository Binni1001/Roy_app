import { supabase } from "../../config/supabase.js";

export const peopleRepository = {
  async getAll() {
    return await supabase
      .from("people")
      .select("*")
      .order("created_at", { ascending: false });
  },

  async getById(id) {
    return await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .single();
  },

  async getByEmail(email) {
    return await supabase
      .from("people")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
  },

  async getGroupMemberships(personId) {
    return await supabase
      .from("person_groups")
      .select("group_id, status, member_role, joined_at")
      .eq("person_id", personId)
      .order("joined_at", { ascending: true });
  },

  async create(payload) {
    return await supabase
      .from("people")
      .insert([payload])
      .select()
      .single();
  },

  async update(id, payload) {
    return await supabase
      .from("people")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  },

  async remove(id) {
    return await supabase
      .from("people")
      .delete()
      .eq("id", id)
      .select()
      .single();
  }
};
