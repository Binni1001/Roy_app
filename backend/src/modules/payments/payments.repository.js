import { supabase } from "../../config/supabase.js";

export const paymentsRepository = {
  async getUnpaidDebts(personId, periodId) {
    return await supabase
      .from("debts")
      .select("*")
      .eq("person_id", personId)
      .eq("period_id", periodId)
      .eq("status", "unpaid")
      .order("created_at", { ascending: true });
  },

  async getPerson(personId) {
    return await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .single();
  },

  async getPeriod(periodId) {
    return await supabase
      .from("periods")
      .select("*")
      .eq("id", periodId)
      .single();
  },

  async createPayment(payload) {
    return await supabase
      .from("payments")
      .insert([payload])
      .select()
      .single();
  },

  async createPaymentDebt(payload) {
    return await supabase
      .from("payment_debts")
      .insert([payload])
      .select()
      .single();
  },

  async findPendingPayment(personId) {
    return await supabase
      .from("payments")
      .select("*")
      .eq("person_id", personId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  },

  async getPaymentDebts(paymentId) {
    return await supabase
      .from("payment_debts")
      .select(`
        *,
        debt:debts(*)
      `)
      .eq("payment_id", paymentId);
  },

  async cancelPayment(paymentId) {
    return await supabase
      .from("payments")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", paymentId)
      .select()
      .single();
  },

  async findPaymentByOrderCode(orderCode) {
    return await supabase
      .from("payments")
      .select("*")
      .eq("payos_order_code", orderCode)
      .maybeSingle();
  },

  async updatePayment(id, payload) {
    return await supabase
      .from("payments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  },

  async getPaymentDebtsWithDebt(paymentId) {
    return await supabase
      .from("payment_debts")
      .select(`
        *,
        debt:debts(*)
      `)
      .eq("payment_id", paymentId);
  },

  async updateDebt(id, payload) {
    return await supabase
      .from("debts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  },

  async createFundTransaction(payload) {
    return await supabase
      .from("club_fund_transactions")
      .insert([payload])
      .select()
      .single();
  },

  async findPaymentByOrderCode(orderCode) {
    return await supabase
      .from("payments")
      .select("*")
      .eq("payos_order_code", orderCode)
      .maybeSingle();
  },

  async updatePayment(id, payload) {
    return await supabase
      .from("payments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  },

  async getPaymentDebtsWithDebt(paymentId) {
    return await supabase
      .from("payment_debts")
      .select(`
        *,
        debt:debts(*)
      `)
      .eq("payment_id", paymentId);
  },

  async updateDebt(id, payload) {
    return await supabase
      .from("debts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  },

  async createFundTransaction(payload) {
    return await supabase
      .from("club_fund_transactions")
      .insert([payload])
      .select()
      .single();
  }
};