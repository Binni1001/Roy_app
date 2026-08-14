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
      .select(`*, person:people(id, full_name, nickname, phone), period:periods(id, name)`)
      .single();
  },

  async refundPerson(payload) {
    return await supabase.rpc("refund_person_balance", {
      p_person_id: payload.person_id,
      p_period_id: payload.period_id || null,
      p_amount: Number(payload.amount),
      p_description: payload.description || null
    });
  },

  async update(id, payload) {
    return await supabase
      .from("club_fund_transactions")
      .update(payload)
      .eq("id", id)
      .select(`*, person:people(id, full_name, nickname, phone), period:periods(id, name)`)
      .single();
  },

  async remove(id) {
    return await supabase
      .from("club_fund_transactions")
      .delete()
      .eq("id", id);
  },

};
