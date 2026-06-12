import { supabase } from "../../config/supabase.js";

export const dashboardRepository = {
  async getPeriod(periodId) {
    return await supabase
      .from("periods")
      .select("*")
      .eq("id", periodId)
      .single();
  },

  async getDebts(periodId) {
    return await supabase
      .from("debts")
      .select(`
        *,
        person:people(id, full_name, nickname, phone)
      `)
      .eq("period_id", periodId);
  },

  async getFundTransactions(periodId) {
    return await supabase
      .from("club_fund_transactions")
      .select("*")
      .eq("period_id", periodId);
  },

  async getFixedMembers(periodId) {
    return await supabase
      .from("period_members")
      .select(`
        *,
        person:people(id, full_name, nickname, phone)
      `)
      .eq("period_id", periodId)
      .eq("status", "fixed");
  },

  async getShuttleExpenses(periodId) {
    return await supabase
      .from("shuttle_expenses")
      .select("*")
      .eq("period_id", periodId);
  },

  async getPersonBalances() {
    return await supabase
      .from("person_balances")
      .select(`
        *,
        person:people(id, full_name, nickname, phone)
      `);
  }
};