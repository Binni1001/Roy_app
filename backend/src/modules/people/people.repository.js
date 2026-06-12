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

  async create(payload) {
    return await supabase
      .from("people")
      .insert([payload])
      .select()
      .single();
  }
};