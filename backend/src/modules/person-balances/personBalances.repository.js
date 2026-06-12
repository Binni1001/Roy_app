import { supabase } from "../../config/supabase.js";

export const personBalancesRepository = {
  async getAllBalances() {
    return await supabase
      .from("person_balances")
      .select(`
        *,
        person:people(
          id,
          full_name,
          nickname,
          phone
        )
      `)
      .order("balance", { ascending: false });
  },

  async getBalanceByPerson(personId) {
    return await supabase
      .from("person_balances")
      .select(`
        *,
        person:people(
          id,
          full_name,
          nickname,
          phone
        )
      `)
      .eq("person_id", personId)
      .maybeSingle();
  },

  async getTransactions(personId) {
    return await supabase
      .from("balance_transactions")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
  }
};