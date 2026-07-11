import { payOS } from "../../config/payos.js";
import { paymentsRepository } from "./payments.repository.js";

function generateOrderCode() {
  return Number(Date.now().toString().slice(-10));
}

function isMissingRpc(error) {
  return error?.code === "PGRST202" || /function .* does not exist/i.test(error?.message || "");
}

export const paymentsService = {
  async createForPersonPeriod(payload = {}) {
    const { person_id, period_id } = payload;

    if (!person_id) throw new Error("Person ID khong duoc de trong");
    if (!period_id) throw new Error("Period ID khong duoc de trong");

    const debtsResult = await paymentsRepository.getUnpaidDebts(person_id, period_id);
    if (debtsResult.error) throw new Error(debtsResult.error.message);
    const debts = debtsResult.data;
    if (!debts.length) throw new Error("Nguoi nay khong co cong no unpaid trong ky nay");

    const periodResult = await paymentsRepository.getPeriod(period_id);
    if (periodResult.error) throw new Error(periodResult.error.message);

    return this._buildPaymentForDebts(
      person_id,
      debts,
      `Thanh toan cong no ${periodResult.data?.name || ""}`.trim()
    );
  },

  // Gom TẤT CẢ nợ chưa trả của 1 người (mọi kỳ) vào 1 QR
  async createForPerson(payload = {}) {
    const { person_id } = payload;
    if (!person_id) throw new Error("Person ID khong duoc de trong");

    const debtsResult = await paymentsRepository.getUnpaidDebtsAllPeriods(person_id);
    if (debtsResult.error) throw new Error(debtsResult.error.message);
    const debts = debtsResult.data;
    if (!debts.length) throw new Error("Nguoi nay khong con cong no unpaid nao");

    return this._buildPaymentForDebts(person_id, debts, "Thanh toan tat ca cong no");
  },

  // Dựng payment PayOS từ 1 danh sách nợ (dùng chung cho theo-kỳ và tất-cả-kỳ)
  async _buildPaymentForDebts(person_id, debts, paymentDescription) {
    const personResult = await paymentsRepository.getPerson(person_id);
    if (personResult.error) throw new Error(personResult.error.message);

    const person = personResult.data;

    const totalAmount = debts.reduce(
      (sum, debt) => sum + Number(debt.amount),
      0
    );

    const pendingPaymentsResult =
      await paymentsRepository.getPendingPayments(person_id);

    if (pendingPaymentsResult.error) {
      throw new Error(pendingPaymentsResult.error.message);
    }

    const pendingPayments = pendingPaymentsResult.data || [];
    const currentDebtIds = debts.map((item) => item.id).sort();

    for (const pendingPayment of pendingPayments) {
      const paymentDebtsResult =
        await paymentsRepository.getPaymentDebts(pendingPayment.id);

      if (paymentDebtsResult.error) {
        throw new Error(paymentDebtsResult.error.message);
      }

      const paymentDebts = paymentDebtsResult.data || [];

      const oldDebtIds = paymentDebts.map((item) => item.debt_id).sort();

      const sameDebts =
        oldDebtIds.length === currentDebtIds.length &&
        oldDebtIds.every((id, index) => id === currentDebtIds[index]);

      const sameAmount =
        Number(pendingPayment.amount) === Number(totalAmount);

      if (sameDebts && sameAmount) {
        return {
          message: "Da co payment pending, dung lai QR cu",
          reused: true,
          payment: pendingPayment,
          debts,
          checkout_url: pendingPayment.payos_checkout_url,
          qr_code: pendingPayment.payos_qr_code
        };
      }

      const overlapsCurrentDebts = oldDebtIds.some((id) =>
        currentDebtIds.includes(id)
      );

      if (overlapsCurrentDebts) {
        await paymentsRepository.cancelPayment(pendingPayment.id);
      }
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
      description: paymentDescription,
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

    const orderCode =
      verifiedData?.data?.orderCode ||
      verifiedData?.orderCode ||
      webhookBody?.data?.orderCode ||
      webhookBody?.orderCode;

    const code =
      verifiedData?.code ||
      webhookBody?.code ||
      webhookBody?.data?.code;

    if (!orderCode) {
      return {
        message: "Webhook received but orderCode is missing",
        test_webhook: true,
        webhookBody,
        verifiedData
      };
    }

    const paymentResult =
      await paymentsRepository.findPaymentByOrderCode(Number(orderCode));

    if (paymentResult.error) {
      throw new Error(paymentResult.error.message);
    }

    const payment = paymentResult.data;

    if (!payment) {
      return {
        message: "Webhook hop le nhung orderCode chua ton tai trong he thong. Co the la request test tu PayOS.",
        test_webhook: true,
        orderCode
      };
    }

    const now = new Date().toISOString();

    if (code !== "00") {
      const failedRpcResult = await paymentsRepository.markPaymentFailed(
        Number(orderCode),
        webhookBody
      );

      if (!failedRpcResult.error) {
        return failedRpcResult.data;
      }

      if (!isMissingRpc(failedRpcResult.error)) {
        throw new Error(failedRpcResult.error.message);
      }

      const failedResult = await paymentsRepository.updatePayment(payment.id, {
        status: "failed",
        raw_payload: webhookBody,
        updated_at: now
      });

      if (failedResult.error) {
        throw new Error(failedResult.error.message);
      }

      return {
        message: "Payment khong thanh cong",
        payment: failedResult.data
      };
    }

    const paidRpcResult = await paymentsRepository.processPaidPayment(
      Number(orderCode),
      webhookBody
    );

    if (!paidRpcResult.error) {
      return paidRpcResult.data;
    }

    if (!isMissingRpc(paidRpcResult.error)) {
      throw new Error(paidRpcResult.error.message);
    }

    const paymentDebtsResult =
      await paymentsRepository.getPaymentDebtsWithDebt(payment.id);

    if (paymentDebtsResult.error) {
      throw new Error(paymentDebtsResult.error.message);
    }

    const paymentDebts = paymentDebtsResult.data || [];
    const updatedDebts = [];
    const fundTransactions = [];

    // Kỳ đang mở (để ghi tiền trả nợ cũ vào đúng kỳ hiện tại nếu kỳ gốc đã chốt)
    const openPeriodResult = await paymentsRepository.getOpenPeriod();
    const openPeriodId = openPeriodResult?.data?.id || null;

    for (const item of paymentDebts) {
      const debt = item.debt;

      if (!debt) continue;

      const debtResult = await paymentsRepository.updateDebt(debt.id, {
        status: "paid",
        paid_at: now,
        updated_at: now
      });

      if (debtResult.error) {
        throw new Error(debtResult.error.message);
      }

      updatedDebts.push(debtResult.data);

      const fundDescription = debt.description
        ? `Thu tien - ${debt.description}`
        : `Thu tien ${debt.debt_type}`;
      // FIX #1: dùng debt_id để check duplicate (không dùng amount nữa)
      const existingFundResult = await paymentsRepository.findFundTransaction(
        payment.id,
        debt.id
      );

      if (existingFundResult.error) {
        throw new Error(existingFundResult.error.message);
      }

      if (existingFundResult.data) {
        fundTransactions.push(existingFundResult.data);
        continue;
      }

      // Kỳ gốc còn mở -> ghi kỳ gốc; đã chốt -> ghi vào kỳ đang mở
      const periodResult = await paymentsRepository.getPeriod(debt.period_id);
      const debtPeriodStatus = periodResult?.data?.status;
      const targetPeriodId =
        debtPeriodStatus === "open" || !openPeriodId ? debt.period_id : openPeriodId;

      const fundResult = await paymentsRepository.createFundTransaction({
        period_id: targetPeriodId,
        person_id: debt.person_id,
        payment_id: payment.id,
        debt_id: debt.id,
        transaction_type: "income",
        amount: Number(debt.amount),
        description: fundDescription
      });

      if (fundResult.error) {
        throw new Error(fundResult.error.message);
      }

      fundTransactions.push(fundResult.data);
    }

    const updatedPaymentResult = await paymentsRepository.updatePayment(payment.id, {
      status: "paid",
      paid_at: now,
      raw_payload: webhookBody,
      updated_at: now
    });

    if (updatedPaymentResult.error) {
      throw new Error(updatedPaymentResult.error.message);
    }

    return {
      message: "PayOS webhook processed",
      payment: updatedPaymentResult.data,
      updated_debts: updatedDebts,
      fund_transactions: fundTransactions
    };
  },

  async cancelPayment(paymentId) {
    if (!paymentId) {
      throw new Error("Payment ID khong duoc de trong");
    }

    const result = await paymentsRepository.cancelPayment(paymentId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return {
      message: "Da huy payment pending",
      payment: result.data
    };
  }
};


