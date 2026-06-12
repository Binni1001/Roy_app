import { supabase } from "../../config/supabase.js";

export const clubFundTransactionsRepository = {
  async getAll() {
    return await supabase
      .from("club_fund_transactions")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        period:periods(id, name, start_date, end_date),
        payment:payments(id, amount, status, payos_order_code)
      `)
      .order("created_at", { ascending: false });
  },

  async getByPeriod(periodId) {
    return await supabase
      .from("club_fund_transactions")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        period:periods(id, name, start_date, end_date),
        payment:payments(id, amount, status, payos_order_code)
      `)
      .eq("period_id", periodId)
      .order("created_at", { ascending: false });
  },

  async create(payload) {
    return await supabase
      .from("club_fund_transactions")
      .insert([payload])
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        period:periods(id, name)
      `)
      .single();
  }
};