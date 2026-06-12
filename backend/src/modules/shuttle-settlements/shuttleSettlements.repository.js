import { supabase } from "../../config/supabase.js";

export const shuttleSettlementsRepository = {
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
  }
};