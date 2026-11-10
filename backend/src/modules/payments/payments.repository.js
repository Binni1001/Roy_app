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

  // Atomically reserves a pending payment (order code, payment, payment_debts) for
  // the given debts, reusing an identical pending one or cancelling overlapping ones.
  async createPendingPayment({ personId, debtIds, description, returnUrl, cancelUrl }) {
    return await supabase.rpc("create_pending_payment", {
      p_person_id: personId,
      p_debt_ids: debtIds,
      p_description: description,
      p_return_url: returnUrl || null,
      p_cancel_url: cancelUrl || null
    });
  },

  async attachPayosLink(paymentId, { checkoutUrl, qrCode, rawPayload }) {
    return await supabase.rpc("attach_payos_link", {
      p_payment_id: paymentId,
      p_checkout_url: checkoutUrl,
      p_qr_code: qrCode || null,
      p_raw_payload: rawPayload || {}
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

  async getUnpaidDebtsByGroup(personId, groupId) {
    let query = supabase
      .from("debts")
      .select(`
        *,
        period:periods!inner(id, group_id)
      `)
      .eq("person_id", personId)
      .eq("status", "unpaid")
      .order("created_at", { ascending: true });

    query = groupId
      ? query.eq("period.group_id", groupId)
      : query.is("period.group_id", null);

    return await query;
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

  async getPayment(paymentId) {
    return await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
  },

  // Only a still-pending payment can be cancelled; returns data=null otherwise.
  async cancelPendingPayment(paymentId) {
    return await supabase
      .from("payments")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", paymentId)
      .eq("status", "pending")
      .select()
      .maybeSingle();
  },

  async findPaymentByOrderCode(orderCode) {
    return await supabase
      .from("payments")
      .select("*")
      .eq("payos_order_code", orderCode)
      .maybeSingle();
  }
};
