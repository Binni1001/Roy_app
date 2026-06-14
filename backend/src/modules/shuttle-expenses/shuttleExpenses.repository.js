import { supabase } from "../../config/supabase.js";

export const shuttleExpensesRepository = {
  async getAll() {
    return await supabase
      .from("shuttle_expenses")
      .select(`
        *,
        buyer:people(id, full_name, nickname, phone),
        period:periods(id, name, start_date, end_date)
      `)
      .order("buy_date", { ascending: false });
  },

  async getByPeriodId(periodId) {
    return await supabase
      .from("shuttle_expenses")
      .select(`
        *,
        buyer:people(id, full_name, nickname, phone),
        period:periods(id, name, start_date, end_date)
      `)
      .eq("period_id", periodId)
      .order("buy_date", { ascending: false });
  },

  async create(payload) {
    return await supabase
      .from("shuttle_expenses")
      .insert([payload])
      .select(`
        *,
        buyer:people(id, full_name, nickname, phone),
        period:periods(id, name)
      `)
      .single();
  },

  async update(id, payload) {
    return await supabase
      .from("shuttle_expenses")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        buyer:people(id, full_name, nickname, phone),
        period:periods(id, name)
      `)
      .single();
  },

  async remove(id) {
    return await supabase
      .from("shuttle_expenses")
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
  },

  async getFixedMember(periodId, personId) {
    return await supabase
      .from("period_members")
      .select("id")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .eq("status", "fixed")
      .maybeSingle();
  }
};