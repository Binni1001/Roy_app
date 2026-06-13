import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

function listFiles(dir, predicate = () => true) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? listFiles(path, predicate)
      : predicate(path)
        ? [path]
        : [];
  });
}

test("app mounts all active backend modules", () => {
  const app = read("src/app.js");
  const mounts = [
    "/api/people",
    "/api/periods",
    "/api/period-members",
    "/api/badminton-sessions",
    "/api/guest-attendances",
    "/api/debts",
    "/api/shuttle-expenses",
    "/api/shuttle-settlements",
    "/api/person-balances",
    "/api/balance-offsets",
    "/api/club-fund-transactions",
    "/api/dashboard",
    "/api/payments"
  ];

  for (const mount of mounts) {
    assert.match(app, new RegExp(`app\\.use\\("${mount.replaceAll("/", "\\/")}"`));
  }
});

test("payments controller has a single PayOS webhook handler", () => {
  const controller = read("src/modules/payments/payments.controller.js");
  const matches = controller.match(/async payosWebhook/g) || [];

  assert.equal(matches.length, 1);
  assert.doesNotMatch(controller, /Webhook received but not processed/);
});

test("payments repository has no duplicate legacy pending-payment method", () => {
  const repository = read("src/modules/payments/payments.repository.js");

  assert.doesNotMatch(repository, /findPendingPayment/);
  assert.match(repository, /getPendingPayments/);
  assert.match(repository, /process_paid_payment/);
  assert.match(repository, /mark_payment_failed/);
});

test("backend source stays ASCII to avoid mojibake regressions", () => {
  const files = listFiles("src", (path) => path.endsWith(".js"));

  for (const file of files) {
    const text = read(file);
    assert.equal(/[^\x00-\x7F]/.test(text), false, `${file} contains non-ASCII text`);
  }
});

test("finance RPC migration exposes required functions", () => {
  const sql = read("../supabase/20260613_atomic_finance_rpc.sql");
  const functions = [
    "process_paid_payment",
    "mark_payment_failed",
    "settle_shuttle_period",
    "offset_person_period"
  ];

  for (const name of functions) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}`));
  }
});
