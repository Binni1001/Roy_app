import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const person = id(1), group = id(2), period = id(3);
const [d1, d2, d3] = [id(11), id(12), id(13)];

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table periods(id uuid primary key, group_id uuid, status text, start_date date);
    create table debts(id uuid primary key, person_id uuid, period_id uuid, status text default 'unpaid',
      amount numeric, debt_type text default 'monthly_fee', description text, paid_at timestamptz, updated_at timestamptz);
    create table payments(id uuid primary key default gen_random_uuid(), person_id uuid, amount numeric not null,
      status text not null, provider text, payos_order_code bigint, payos_checkout_url text not null,
      payos_qr_code text, description text, return_url text, cancel_url text, raw_payload jsonb not null,
      paid_at timestamptz, created_at timestamptz default now(), updated_at timestamptz);
    create table payment_debts(payment_id uuid references payments(id), debt_id uuid references debts(id), amount numeric);
    create table club_fund_transactions(id uuid primary key default gen_random_uuid(), period_id uuid, person_id uuid,
      payment_id uuid, debt_id uuid, transaction_type text, amount numeric, description text);
    insert into periods values ('${period}','${group}','open','2026-01-01');
    insert into debts(id, person_id, period_id, amount) values
      ('${d1}','${person}','${period}',100000), ('${d2}','${person}','${period}',50000), ('${d3}','${person}','${period}',20000);
  `);
  await db.exec(await readFile(new URL("../../supabase/20261110_payos_payment_hardening.sql", import.meta.url), "utf8"));
  return db;
}

const create = (db, ids) => db.query("select create_pending_payment($1,$2::uuid[],'test','r','c') as r", [person, ids]).then((x) => x.rows[0].r);
const attach = (db, paymentId) => db.query("select attach_payos_link($1,'https://pay','qr','{}') as r", [paymentId]).then((x) => x.rows[0].r);
const paid = (db, code, amount) =>
  db.query("select process_paid_payment($1,$2::jsonb) as r", [code, JSON.stringify({ data: { amount } })]).then((x) => x.rows[0].r);
const status = async (db, table, key) => (await db.query(`select status from ${table} where id=$1`, [key])).rows[0].status;

test("payment creation is atomic, sequenced and reusable", async (t) => {
  const db = await setup();
  t.after(() => db.close());

  await t.test("creates the payment with all debts and a sequenced order code", async () => {
    const r = await create(db, [d1, d2]);
    assert.equal(r.reused, false);
    assert.equal(Number(r.payment.amount), 150000);
    assert.ok(Number(r.payment.payos_order_code) >= 10000000000);
    const links = await db.query("select count(*)::int as n from payment_debts where payment_id=$1", [r.payment.id]);
    assert.equal(links.rows[0].n, 2);
  });

  await t.test("a pending payment without a link is not reused; it is replaced", async () => {
    const second = await create(db, [d1, d2]);
    assert.equal(second.reused, false);
    assert.equal(second.cancelled_order_codes.length, 1);
    await attach(db, second.payment.id);
    const again = await create(db, [d2, d1]);
    assert.equal(again.reused, true);
    assert.equal(again.payment.id, second.payment.id);
  });

  await t.test("overlapping new request cancels the old one and order codes never repeat", async () => {
    const before = (await db.query("select * from payments where status='pending'")).rows[0];
    const r = await create(db, [d1, d2, d3]);
    assert.equal(r.reused, false);
    assert.deepEqual(r.cancelled_order_codes.map(String), [String(before.payos_order_code)]);
    assert.equal(await status(db, "payments", before.id), "cancelled");
    assert.notEqual(String(r.payment.payos_order_code), String(before.payos_order_code));
  });

  await t.test("a replaced payment can no longer receive a PayOS link", async () => {
    const old = (await db.query("select id from payments where status='cancelled' limit 1")).rows[0];
    assert.equal(await attach(db, old.id), null);
  });

  await t.test("unknown, settled or foreign debts are rejected", async () => {
    await assert.rejects(create(db, []), /NO_DEBTS/);
    await assert.rejects(create(db, [id(99)]), /DEBTS_CHANGED/);
  });
});

test("webhook processing is idempotent, checks amount and never double-pays", async (t) => {
  const db = await setup();
  t.after(() => db.close());
  const r = await create(db, [d1, d2]);
  await attach(db, r.payment.id);
  const code = r.payment.payos_order_code;

  await t.test("a wrong amount is flagged and nothing is paid", async () => {
    const res = await paid(db, code, 1);
    assert.equal(res.processed, false);
    assert.equal(res.error_code, "AMOUNT_MISMATCH");
    assert.equal(await status(db, "debts", d1), "unpaid");
    assert.equal(await status(db, "payments", r.payment.id), "pending");
  });

  await t.test("a missing amount is also rejected", async () => {
    const res = (await db.query("select process_paid_payment($1,'{}'::jsonb) as r", [code])).rows[0].r;
    assert.equal(res.error_code, "AMOUNT_MISMATCH");
  });

  await t.test("the right amount pays debts and records one fund row per debt", async () => {
    const res = await paid(db, code, 150000);
    assert.equal(res.processed, true);
    assert.equal(await status(db, "debts", d1), "paid");
    assert.equal(await status(db, "payments", r.payment.id), "paid");
    const funds = await db.query("select count(*)::int as n, sum(amount)::int as total from club_fund_transactions");
    assert.deepEqual(funds.rows[0], { n: 2, total: 150000 });
  });

  await t.test("replaying the webhook changes nothing", async () => {
    const res = await paid(db, code, 150000);
    assert.equal(res.already_processed, true);
    assert.equal((await db.query("select count(*)::int as n from club_fund_transactions")).rows[0].n, 2);
  });

  await t.test("a failure notice cannot downgrade a paid payment", async () => {
    const res = (await db.query("select mark_payment_failed($1,'{}'::jsonb) as r", [code])).rows[0].r;
    assert.equal(res.ignored, true);
    assert.equal(await status(db, "payments", r.payment.id), "paid");
  });
});

test("money for a cancelled payment is honoured only if its debts are still unpaid", async (t) => {
  const db = await setup();
  t.after(() => db.close());
  const first = await create(db, [d1]);
  await attach(db, first.payment.id);
  const second = await create(db, [d1, d2]); // cancels the first
  await attach(db, second.payment.id);
  assert.equal(await status(db, "payments", first.payment.id), "cancelled");

  await t.test("late payment on the cancelled link settles the debt once", async () => {
    const res = await paid(db, first.payment.payos_order_code, 100000);
    assert.equal(res.processed, true);
    assert.equal(res.previous_status, "cancelled");
    assert.equal(await status(db, "debts", d1), "paid");
  });

  await t.test("paying the replacement afterwards is flagged, not double-counted", async () => {
    const res = await paid(db, second.payment.payos_order_code, 150000);
    assert.equal(res.processed, false);
    assert.equal(res.error_code, "REQUIRES_RECONCILIATION");
    assert.equal(await status(db, "debts", d2), "unpaid");
    assert.equal((await db.query("select count(*)::int as n from club_fund_transactions")).rows[0].n, 1);
  });
});

test("payment functions are not callable by client roles", async () => {
  const db = await setup();
  const rows = (await db.query(`
    select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
           has_function_privilege('authenticated', p.oid, 'execute') as auth,
           has_function_privilege('service_role', p.oid, 'execute') as svc
    from pg_proc p where p.proname in
      ('create_pending_payment','attach_payos_link','process_paid_payment','mark_payment_failed')`)).rows;
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.deepEqual([row.anon, row.auth, row.svc], [false, false, true], row.proname);
  }
  await db.close();
});
