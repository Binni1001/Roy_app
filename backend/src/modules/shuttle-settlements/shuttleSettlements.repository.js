import { supabase } from "../../config/supabase.js";

export const shuttleSettlementsRepository = {
  async previewPeriod(periodId) {
    return supabase.rpc("preview_shuttle_period", { p_period_id: periodId });
  },
  applyFund(periodId, buyerId, amount) {
    return supabase.rpc("apply_fund_to_shuttles", { p_period_id: periodId, p_buyer_id: buyerId, p_amount: amount });
  },
  async settlePeriod(periodId) {
    return await supabase.rpc("settle_shuttle_period", {
      p_period_id: periodId
    });
  },

  async getFixedMembers(periodId) {
    return await supabase
      .from("period_members")
      .select(`
        *,
        person:people(id, full_name, nickname, phone)
      `)
      .eq("period_id", periodId)
      .eq("status", "fixed")
      .eq("exempt_shuttle", false);
  },

  async getShuttleExpenses(periodId) {
    return await supabase
      .from("shuttle_expenses")
      .select(`
        *,
        buyer:people(id, full_name, nickname, phone)
      `)
      .eq("period_id", periodId);
  },

  async findPersonBalance(personId) {
    return await supabase
      .from("person_balances")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle();
  },

  async createPersonBalance(personId, balance) {
    return await supabase
      .from("person_balances")
      .insert([
        {
          person_id: personId,
          balance
        }
      ])
      .select()
      .single();
  },

  async updatePersonBalance(personId, balance) {
    return await supabase
      .from("person_balances")
      .update({
        balance,
        updated_at: new Date().toISOString()
      })
      .eq("person_id", personId)
      .select()
      .single();
  },

  async createBalanceTransaction(payload) {
    return await supabase
      .from("balance_transactions")
      .insert([payload])
      .select()
      .single();
  },

  async createDebt(payload) {
    return await supabase
      .from("debts")
      .insert([payload])
      .select()
      .single();
  },

  async getSettlementTransactions(periodId) {
    return await supabase
      .from("balance_transactions")
      .select("*")
      .eq("period_id", periodId)
      .in("transaction_type", [
        "credit_from_shuttle_purchase",
        "debit_shuttle_share"
      ]);
  },

  async getPeriodById(periodId) {
    return await supabase
      .from("periods")
      .select("id, name, status")
      .eq("id", periodId)
      .maybeSingle();
  },

  async createNotifications(notifications) {
    return await supabase
      .from("notifications")
      .insert(notifications)
      .select();
  }
};
