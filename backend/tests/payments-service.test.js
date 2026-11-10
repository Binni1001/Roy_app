import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentsService } from "../src/modules/payments/payments.service.js";

const quiet = { error() {} };

function makeDeps({ reservation, verify, createLink, attached, payment } = {}) {
  const calls = { cancelled: [], payosCancel: [], created: [], attached: [], processed: [], failed: [] };
  const repository = {
    getUnpaidDebts: async () => ({ data: [{ id: "d1", debt_type: "monthly_fee", amount: 100000 }] }),
    getUnpaidDebtsByGroup: async () => ({ data: [{ id: "d1", debt_type: "monthly_fee", amount: 100000 }] }),
    getPeriod: async () => ({ data: { id: "p1", name: "Ky 1", group_id: "g1" } }),
    getPerson: async () => ({ data: { id: "u1", nickname: "Roy" } }),
    getPayment: async () => ({ data: payment }),
    createPendingPayment: async () => reservation ?? {
      data: { reused: false, payment: { id: "pay1", payos_order_code: 10000000001, amount: 100000 }, cancelled_order_codes: [] }
    },
    attachPayosLink: async (id, link) => {
      calls.attached.push({ id, link });
      return attached ?? { data: { id, status: "pending", payos_checkout_url: link.checkoutUrl } };
    },
    cancelPendingPayment: async (id) => { calls.cancelled.push(id); return { data: { id, status: "cancelled" } }; },
    processPaidPayment: async (code, body) => { calls.processed.push({ code, body }); return { data: { processed: true } }; },
    markPaymentFailed: async (code) => { calls.failed.push(code); return { data: { message: "Payment failed" } }; }
  };
  const payOS = {
    paymentRequests: {
      create: async (data) => {
        calls.created.push(data);
        if (createLink) return createLink(data);
        return { checkoutUrl: "https://pay.test/x", qrCode: "qr" };
      },
      cancel: async (code) => { calls.payosCancel.push(code); },
      get: async () => ({ status: "PENDING" })
    },
    webhooks: { verify: verify ?? (async (body) => body.data) }
  };
  return { service: createPaymentsService({ payOS, repository, logger: quiet }), calls, payOS };
}

test("creating a payment reserves it atomically, then stores the PayOS link", async () => {
  const { service, calls } = makeDeps();
  const result = await service.createForPersonPeriod({ person_id: "u1", period_id: "p1" });

  assert.equal(result.reused, false);
  assert.equal(result.checkout_url, "https://pay.test/x");
  assert.equal(calls.created[0].orderCode, 10000000001);
  assert.equal(calls.created[0].amount, 100000);
  assert.equal(calls.attached.length, 1);
});

test("an identical pending payment is reused without calling PayOS", async () => {
  const { service, calls } = makeDeps({
    reservation: { data: { reused: true, payment: { id: "pay1", payos_checkout_url: "https://old", payos_qr_code: "q" } } }
  });
  const result = await service.createForPerson({ person_id: "u1", period_id: "p1" });

  assert.equal(result.reused, true);
  assert.equal(result.checkout_url, "https://old");
  assert.equal(calls.created.length, 0);
});

test("replaced pending payments are cancelled on PayOS too", async () => {
  const { service, calls } = makeDeps({
    reservation: {
      data: { reused: false, payment: { id: "pay2", payos_order_code: 10000000002, amount: 100000 }, cancelled_order_codes: [10000000001] }
    }
  });
  await service.createForPerson({ person_id: "u1", period_id: "p1" });
  assert.deepEqual(calls.payosCancel, [10000000001]);
});

test("a PayOS failure releases the reserved payment", async () => {
  const { service, calls } = makeDeps({ createLink: () => { throw new Error("payos down"); } });
  await assert.rejects(service.createForPerson({ person_id: "u1", period_id: "p1" }), /payos down/);
  assert.deepEqual(calls.cancelled, ["pay1"]);
});

test("a payment replaced while the link was created drops the new PayOS link", async () => {
  const { service, calls } = makeDeps({ attached: { data: null } });
  await assert.rejects(service.createForPerson({ person_id: "u1", period_id: "p1" }), /thay the/);
  assert.deepEqual(calls.payosCancel, [10000000001]);
});

test("a missing RPC reports the migration instead of a non-atomic fallback", async () => {
  const { service } = makeDeps({ reservation: { error: { code: "PGRST202", message: "not found" } } });
  await assert.rejects(service.createForPerson({ person_id: "u1", period_id: "p1" }), /20261110_payos_payment_hardening/);
});

test("webhook with an invalid signature is rejected before touching the database", async () => {
  const { service, calls } = makeDeps({ verify: async () => { throw new Error("Data not integrity"); } });
  await assert.rejects(
    service.handlePayosWebhook({ code: "00", data: { orderCode: 10000000001, amount: 1 }, signature: "forged" }),
    (error) => error.status === 400
  );
  assert.equal(calls.processed.length, 0);
});

test("webhook decisions use the signed payload, not the unsigned top-level code", async () => {
  const { service, calls } = makeDeps();
  await service.handlePayosWebhook({ code: "00", data: { orderCode: 10000000001, amount: 1, code: "01" }, signature: "s" });
  assert.deepEqual(calls.failed, [10000000001]);
  assert.equal(calls.processed.length, 0);

  await service.handlePayosWebhook({ code: "01", data: { orderCode: 10000000001, amount: 1, code: "00" }, signature: "s" });
  assert.equal(calls.processed.length, 1);
});

test("webhook that cannot be applied is returned for reconciliation, not hidden", async () => {
  const { service } = makeDeps();
  const logged = [];
  const repo = { processPaidPayment: async () => ({ data: { processed: false, error_code: "AMOUNT_MISMATCH" } }) };
  const custom = createPaymentsService({
    payOS: { webhooks: { verify: async (b) => b.data }, paymentRequests: {} },
    repository: repo,
    logger: { error: (m) => logged.push(m) }
  });
  const result = await custom.handlePayosWebhook({ data: { orderCode: 5, amount: 9, code: "00" }, signature: "s" });
  assert.equal(result.error_code, "AMOUNT_MISMATCH");
  assert.match(logged[0], /AMOUNT_MISMATCH/);
  assert.ok(service);
});

test("cancelling refuses a link that PayOS already paid", async () => {
  const { service, calls, payOS } = makeDeps({
    payment: { id: "pay1", status: "pending", payos_order_code: 10000000001, payos_checkout_url: "https://x" }
  });
  payOS.paymentRequests.cancel = async () => { throw new Error("already paid"); };
  payOS.paymentRequests.get = async () => ({ status: "PAID" });

  await assert.rejects(service.cancelPayment("pay1"), /da duoc thanh toan/);
  assert.equal(calls.cancelled.length, 0);
});

test("only pending payments can be cancelled, and PayOS is cancelled first", async () => {
  const pending = makeDeps({
    payment: { id: "pay1", status: "pending", payos_order_code: 10000000001, payos_checkout_url: "https://x" }
  });
  const result = await pending.service.cancelPayment("pay1");
  assert.equal(result.payment.status, "cancelled");
  assert.deepEqual(pending.calls.payosCancel, [10000000001]);

  const paid = makeDeps({ payment: { id: "pay1", status: "paid" } });
  await assert.rejects(paid.service.cancelPayment("pay1"), /pending/);
});
