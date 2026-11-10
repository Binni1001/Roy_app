import { payOS as defaultPayOS } from "../../config/payos.js";
import { paymentsRepository as defaultRepository } from "./payments.repository.js";

const RPC_MISSING_MESSAGE =
  "Thiếu hàm thanh toán trong database. Hãy chạy supabase/20261110_payos_payment_hardening.sql.";

function isMissingRpc(error) {
  return error?.code === "PGRST202" || /function .* does not exist/i.test(error?.message || "");
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function unwrap(result) {
  if (result.error) {
    if (isMissingRpc(result.error)) throw new Error(RPC_MISSING_MESSAGE);
    throw new Error(result.error.message);
  }
  return result.data;
}

const RPC_ERRORS = {
  NO_DEBTS: "Nguoi nay khong co cong no unpaid de thanh toan",
  DEBTS_CHANGED: "Cong no vua thay doi (da thanh toan hoac bi xoa). Vui long tai lai va thu lai.",
  INVALID_DEBT_AMOUNT: "Co khoan cong no co so tien khong hop le"
};

function friendlyRpcError(error) {
  const code = Object.keys(RPC_ERRORS).find((key) => error?.message?.includes(key));
  return code ? new Error(RPC_ERRORS[code]) : error;
}

export function createPaymentsService({
  payOS = defaultPayOS,
  repository = defaultRepository,
  logger = console
} = {}) {
  // Cancels a PayOS link. Returns { paid: true } when the link was already paid.
  // Throws only when the link state is unknown, so callers never assume "cancelled".
  async function cancelPayosLink(orderCode, reason) {
    try {
      await payOS.paymentRequests.cancel(Number(orderCode), reason);
      return { paid: false };
    } catch (cancelError) {
      let link;
      try {
        link = await payOS.paymentRequests.get(Number(orderCode));
      } catch {
        throw new Error("Khong the huy link PayOS. Vui long thu lai sau.", { cause: cancelError });
      }
      if (link?.status === "PAID" || link?.status === "PROCESSING" || link?.status === "UNDERPAID") {
        return { paid: true };
      }
      return { paid: false };
    }
  }

  async function cancelReplacedLinks(orderCodes) {
    for (const orderCode of orderCodes) {
      try {
        await cancelPayosLink(orderCode, "Replaced by a newer payment request");
      } catch (error) {
        // The webhook still reconciles a late payment on the old link.
        logger.error(`[payos] could not cancel replaced link ${orderCode}: ${error.message}`);
      }
    }
  }

  async function buildPaymentForDebts(personId, debts, paymentDescription) {
    const personResult = await repository.getPerson(personId);
    if (personResult.error) throw new Error(personResult.error.message);
    const person = personResult.data;

    // 1. Reserve payment + payment_debts atomically before touching PayOS.
    const reservation = await repository.createPendingPayment({
      personId,
      debtIds: debts.map((debt) => debt.id),
      description: paymentDescription,
      returnUrl: process.env.PAYOS_RETURN_URL,
      cancelUrl: process.env.PAYOS_CANCEL_URL
    });
    if (reservation.error) {
      if (isMissingRpc(reservation.error)) throw new Error(RPC_MISSING_MESSAGE);
      throw friendlyRpcError(reservation.error);
    }

    const { reused, payment, cancelled_order_codes: cancelledCodes = [] } = reservation.data;

    if (reused) {
      return {
        message: "Da co payment pending, dung lai QR cu",
        reused: true,
        payment,
        debts,
        checkout_url: payment.payos_checkout_url,
        qr_code: payment.payos_qr_code
      };
    }

    await cancelReplacedLinks(cancelledCodes);

    // 2. Create the PayOS link. On failure the reserved payment is released.
    const description = `RB ${person.nickname || person.full_name}`.slice(0, 25);
    let paymentLink;
    try {
      paymentLink = await payOS.paymentRequests.create({
        orderCode: Number(payment.payos_order_code),
        amount: Number(payment.amount),
        description,
        items: debts.map((debt) => ({
          name: debt.debt_type,
          quantity: 1,
          price: Number(debt.amount)
        })),
        returnUrl: process.env.PAYOS_RETURN_URL,
        cancelUrl: process.env.PAYOS_CANCEL_URL
      });
    } catch (error) {
      await repository.cancelPendingPayment(payment.id);
      throw error;
    }

    // 3. Store the link. If the payment was replaced meanwhile, drop the new link.
    const attachResult = await repository.attachPayosLink(payment.id, {
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      rawPayload: paymentLink
    });

    let attached = null;
    let attachError = null;
    if (attachResult.error) attachError = new Error(attachResult.error.message);
    else attached = attachResult.data;

    if (attachError || !attached) {
      try {
        await cancelPayosLink(payment.payos_order_code, "Payment request was replaced");
      } catch (error) {
        logger.error(`[payos] could not cancel orphan link ${payment.payos_order_code}: ${error.message}`);
      }
      if (attachError) {
        await repository.cancelPendingPayment(payment.id);
        throw attachError;
      }
      throw new Error("Lenh thanh toan vua bi thay the boi yeu cau khac. Vui long thu lai.");
    }

    return {
      reused: false,
      payment: attached,
      debts,
      checkout_url: paymentLink.checkoutUrl,
      qr_code: paymentLink.qrCode || null
    };
  }

  return {
    async createForPersonPeriod(payload = {}) {
      const { person_id, period_id } = payload;

      if (!person_id) throw new Error("Person ID khong duoc de trong");
      if (!period_id) throw new Error("Period ID khong duoc de trong");

      const debts = unwrap(await repository.getUnpaidDebts(person_id, period_id));
      if (!debts.length) throw new Error("Nguoi nay khong co cong no unpaid trong ky nay");

      const period = unwrap(await repository.getPeriod(period_id));

      return buildPaymentForDebts(
        person_id,
        debts,
        `Thanh toan cong no ${period?.name || ""}`.trim()
      );
    },

    // Gom tất cả nợ chưa trả của một người trong cùng nhóm vào một QR.
    async createForPerson(payload = {}) {
      const { person_id, period_id } = payload;
      if (!person_id) throw new Error("Person ID khong duoc de trong");
      if (!period_id) throw new Error("Period ID khong duoc de trong");

      const period = unwrap(await repository.getPeriod(period_id));
      const debts = unwrap(
        await repository.getUnpaidDebtsByGroup(person_id, period?.group_id || null)
      );
      if (!debts.length) throw new Error("Nguoi nay khong con cong no unpaid nao");

      return buildPaymentForDebts(person_id, debts, "Thanh toan tat ca cong no");
    },

    async handlePayosWebhook(webhookBody = {}) {
      // verify() is async: it must be awaited or the signature is never enforced.
      let verifiedData;
      try {
        verifiedData = await payOS.webhooks.verify(webhookBody);
      } catch (error) {
        throw httpError(`Invalid PayOS webhook: ${error.message}`, 400);
      }

      const orderCode = verifiedData?.orderCode;
      if (!orderCode) {
        return { message: "Webhook received but orderCode is missing", test_webhook: true };
      }

      // Only the signed payload decides success; top-level `code` is not signed.
      const succeeded = verifiedData.code === "00";

      const rpcResult = succeeded
        ? await repository.processPaidPayment(Number(orderCode), webhookBody)
        : await repository.markPaymentFailed(Number(orderCode), webhookBody);

      const result = unwrap(rpcResult);

      if (result?.processed === false) {
        // Money arrived but could not be applied automatically: needs manual review.
        logger.error(`[payos] ${result.error_code} for order ${orderCode}: ${JSON.stringify(result)}`);
      }

      return result;
    },

    async cancelPayment(paymentId) {
      if (!paymentId) throw new Error("Payment ID khong duoc de trong");

      const payment = unwrap(await repository.getPayment(paymentId));
      if (!payment) throw new Error("Khong tim thay payment");
      if (payment.status !== "pending") {
        throw new Error("Chi co the huy payment dang pending");
      }

      if (payment.payos_order_code && payment.payos_checkout_url) {
        const { paid } = await cancelPayosLink(payment.payos_order_code, "Cancelled by user");
        if (paid) {
          throw new Error("Payment nay da duoc thanh toan. He thong dang doi xac nhan tu PayOS.");
        }
      }

      const cancelled = unwrap(await repository.cancelPendingPayment(paymentId));
      if (!cancelled) throw new Error("Payment khong con o trang thai pending");

      return {
        message: "Da huy payment pending",
        payment: cancelled
      };
    }
  };
}

export const paymentsService = createPaymentsService();
