import { supabase } from "../../config/supabase.js";

export const balanceOffsetsRepository = {
  async offsetPerson(personId) {
    return await supabase.rpc("offset_person_unpaid_debts", {
      p_person_id: personId
    });
  },

  async getPersonBalance(personId) {
    return await supabase
      .from("person_balances")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle();
  },

  async getPositiveBalances() {
    return await supabase
      .from("person_balances")
      .select("person_id, balance")
      .gt("balance", 0);
  },

  async getUnpaidDebts(personId) {
    return await supabase
      .from("debts")
      .select("*")
      .eq("person_id", personId)
      .eq("status", "unpaid")
      .order("created_at", { ascending: true });
  },

  async updateDebt(id, payload) {
    return await supabase
      .from("debts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  },

  async updateBalance(personId, newBalance) {
    return await supabase
      .from("person_balances")
      .update({
        balance: newBalance,
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
  }
};
