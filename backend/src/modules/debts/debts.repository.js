import { supabase } from "../../config/supabase.js";

export const debtsRepository = {
  async getAll() {
    return await supabase
      .from("debts")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        period:periods(id, name, start_date, end_date)
      `)
      .order("created_at", { ascending: false });
  },

  async getByPeriodId(periodId) {
    return await supabase
      .from("debts")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        period:periods(id, name)
      `)
      .eq("period_id", periodId)
      .order("created_at", { ascending: false });
  },

  async getByPersonId(personId) {
    return await supabase
      .from("debts")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        period:periods(id, name)
      `)
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
  },

  async create(payload) {
    return await supabase
      .from("debts")
      .insert([payload])
      .select()
      .single();
  },

  async updateStatus(id, status) {
    return await supabase
      .from("debts")
      .update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
  }
};