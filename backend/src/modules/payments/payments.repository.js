import { supabase } from "../../config/supabase.js";

export const paymentsRepository = {
  async processPaidPayment(orderCode, rawPayload) {
    return await supabase.rpc("process_paid_payment", {
      p_order_code: orderCode,
      p_raw_payload: rawPayload
    });
  },

  async markPaymentFailed(orderCode, rawPayload) {
    return await supabase.rpc("mark_payment_failed", {
      p_order_code: orderCode,
      p_raw_payload: rawPayload
    });
  },

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

  async getOpenPeriod() {
    return await supabase
      .from("periods")
      .select("id, status")
      .eq("status", "open")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
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

  async getPendingPayments(personId) {
    return await supabase
      .from("payments")
      .select("*")
      .eq("person_id", personId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
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

  // FIX #1: dùng debt_id để check duplicate thay vì amount (tránh false-negative khi 2 debt cùng amount)
  async findFundTransaction(paymentId, debtId) {
    return await supabase
      .from("club_fund_transactions")
      .select("*")
      .eq("payment_id", paymentId)
      .eq("debt_id", debtId)
      .maybeSingle();
  }
};
