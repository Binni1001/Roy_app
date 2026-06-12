import { payOS } from "../../config/payos.js";
import { paymentsRepository } from "./payments.repository.js";

function generateOrderCode() {
  return Number(Date.now().toString().slice(-10));
}

export const paymentsService = {
  async createForPersonPeriod(payload = {}) {
    const { person_id, period_id } = payload;

    if (!person_id) throw new Error("Person ID không được để trống");
    if (!period_id) throw new Error("Period ID không được để trống");

    const debtsResult = await paymentsRepository.getUnpaidDebts(
      person_id,
      period_id
    );

    if (debtsResult.error) throw new Error(debtsResult.error.message);

    const debts = debtsResult.data;

    if (!debts.length) {
      throw new Error("Người này không có công nợ unpaid trong kỳ này");
    }

    const personResult = await paymentsRepository.getPerson(person_id);
    if (personResult.error) throw new Error(personResult.error.message);

    const periodResult = await paymentsRepository.getPeriod(period_id);
    if (periodResult.error) throw new Error(periodResult.error.message);

    const person = personResult.data;
    const period = periodResult.data;

    const totalAmount = debts.reduce(
      (sum, debt) => sum + Number(debt.amount),
      0
    );

    const pendingPaymentResult =
      await paymentsRepository.findPendingPayment(person_id);

    if (pendingPaymentResult.error) {
      throw new Error(pendingPaymentResult.error.message);
    }

    const pendingPayment = pendingPaymentResult.data;

    if (pendingPayment) {
      const paymentDebtsResult =
        await paymentsRepository.getPaymentDebts(pendingPayment.id);

      if (paymentDebtsResult.error) {
        throw new Error(paymentDebtsResult.error.message);
      }

      const paymentDebts = paymentDebtsResult.data || [];

      const oldDebtIds = paymentDebts.map((item) => item.debt_id).sort();
      const currentDebtIds = debts.map((item) => item.id).sort();

      const sameDebts =
        oldDebtIds.length === currentDebtIds.length &&
        oldDebtIds.every((id, index) => id === currentDebtIds[index]);

      const sameAmount =
        Number(pendingPayment.amount) === Number(totalAmount);

      if (sameDebts && sameAmount) {
        return {
          message: "Đã có payment pending, dùng lại QR cũ",
          reused: true,
          payment: pendingPayment,
          debts,
          checkout_url: pendingPayment.payos_checkout_url,
          qr_code: pendingPayment.payos_qr_code
        };
      }

      await paymentsRepository.cancelPayment(pendingPayment.id);
    }

    const orderCode = generateOrderCode();

    const description = `RB ${person.nickname || person.full_name}`.slice(0, 25);

    const paymentData = {
      orderCode,
      amount: totalAmount,
      description,
      items: debts.map((debt) => ({
        name: debt.debt_type,
        quantity: 1,
        price: Number(debt.amount)
      })),
      returnUrl: process.env.PAYOS_RETURN_URL,
      cancelUrl: process.env.PAYOS_CANCEL_URL
    };

    const paymentLink = await payOS.paymentRequests.create(paymentData);

    const paymentResult = await paymentsRepository.createPayment({
      person_id,
      amount: totalAmount,
      status: "pending",
      provider: "payos",
      payos_order_code: orderCode,
      payos_checkout_url: paymentLink.checkoutUrl,
      payos_qr_code: paymentLink.qrCode || null,
      description: `Thanh toán công nợ ${period.name}`,
      return_url: process.env.PAYOS_RETURN_URL,
      cancel_url: process.env.PAYOS_CANCEL_URL,
      raw_payload: paymentLink
    });

    if (paymentResult.error) {
      throw new Error(paymentResult.error.message);
    }

    for (const debt of debts) {
      const paymentDebtResult = await paymentsRepository.createPaymentDebt({
        payment_id: paymentResult.data.id,
        debt_id: debt.id,
        amount: Number(debt.amount)
      });

      if (paymentDebtResult.error) {
        throw new Error(paymentDebtResult.error.message);
      }
    }

    return {
      reused: false,
      payment: paymentResult.data,
      debts,
      checkout_url: paymentLink.checkoutUrl,
      qr_code: paymentLink.qrCode || null
    };
  },

  async handlePayosWebhook(webhookBody = {}) {
    const verifiedData = payOS.webhooks.verify(webhookBody);

    const orderCode = verifiedData.orderCode;
    const paymentStatus = verifiedData.code;

    const paymentResult =
      await paymentsRepository.findPaymentByOrderCode(orderCode);

    if (paymentResult.error) {
      throw new Error(paymentResult.error.message);
    }

    const payment = paymentResult.data;

    if (!payment) {
      throw new Error("Không tìm thấy payment theo orderCode");
    }

    if (payment.status === "paid") {
      return {
        message: "Payment đã paid trước đó",
        payment
      };
    }

    if (paymentStatus !== "00") {
      const cancelResult = await paymentsRepository.updatePayment(payment.id, {
        status: "failed",
        raw_payload: webhookBody,
        updated_at: new Date().toISOString()
      });

      if (cancelResult.error) {
        throw new Error(cancelResult.error.message);
      }

      return {
        message: "Payment không thành công",
        payment: cancelResult.data
      };
    }

    const paidAt = new Date().toISOString();

    const updatedPaymentResult = await paymentsRepository.updatePayment(payment.id, {
      status: "paid",
      paid_at: paidAt,
      raw_payload: webhookBody,
      updated_at: paidAt
    });

    if (updatedPaymentResult.error) {
      throw new Error(updatedPaymentResult.error.message);
    }

    const paymentDebtsResult =
      await paymentsRepository.getPaymentDebtsWithDebt(payment.id);

    if (paymentDebtsResult.error) {
      throw new Error(paymentDebtsResult.error.message);
    }

    const paymentDebts = paymentDebtsResult.data || [];
    const updatedDebts = [];

    for (const item of paymentDebts) {
      const debt = item.debt;

      if (!debt) continue;

      const debtResult = await paymentsRepository.updateDebt(debt.id, {
        status: "paid",
        paid_at: paidAt,
        updated_at: paidAt
      });

      if (debtResult.error) {
        throw new Error(debtResult.error.message);
      }

      updatedDebts.push(debtResult.data);

      const fundResult = await paymentsRepository.createFundTransaction({
        period_id: debt.period_id,
        person_id: debt.person_id,
        payment_id: payment.id,
        transaction_type: "income",
        amount: Number(debt.amount),
        description: `Thu tiền ${debt.debt_type}`
      });

      if (fundResult.error) {
        throw new Error(fundResult.error.message);
      }
    }

    return {
      message: "Xử lý webhook PayOS thành công",
      payment: updatedPaymentResult.data,
      updated_debts: updatedDebts
    };
  }
};