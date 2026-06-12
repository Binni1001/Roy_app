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
  }
};