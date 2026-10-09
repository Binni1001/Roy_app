import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const period = "00000000-0000-0000-0000-000000000001";
const group = "00000000-0000-0000-0000-000000000010";
const older = "00000000-0000-0000-0000-000000000002";
const next = "00000000-0000-0000-0000-000000000003";
const person = (n) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table periods(id uuid primary key, name text, status text, group_id uuid, start_date date);
    create table people(id uuid primary key, full_name text, status text);
    create table person_groups(person_id uuid, group_id uuid, status text);
    create type shuttle_buy_type as enum ('tube', 'single', 'mixed');
    create table period_members(id uuid primary key, period_id uuid references periods,
      person_id uuid references people, status text, exempt_shuttle boolean default false);
    create table shuttle_expenses(id uuid primary key default gen_random_uuid(), period_id uuid references periods,
      buyer_id uuid references people, total_amount numeric, total_shuttle_count integer, buy_date date,
      buy_type shuttle_buy_type, tube_count integer, shuttle_per_tube integer, single_count integer, note text);
    create table shuttle_settlement_runs(period_id uuid primary key references periods,
      total_shuttle_amount numeric, share_per_member numeric, result jsonb default '{}');
    create table person_balances(person_id uuid primary key, balance numeric, updated_at timestamptz);
    create table balance_transactions(person_id uuid, period_id uuid, transaction_type text,
      amount numeric, direction text, description text, related_debt_id uuid);
    create table debts(id uuid primary key default gen_random_uuid(), period_id uuid,
      person_id uuid, debt_type text, amount numeric, status text, description text,
      created_at timestamptz default now(), updated_at timestamptz, paid_at timestamptz);
    create table club_fund_transactions(id uuid primary key default gen_random_uuid(), period_id uuid,
      person_id uuid, transaction_type text, amount numeric, description text, debt_id uuid);
    create function offset_person_unpaid_debts(uuid) returns jsonb language sql as $$ select '{}'::jsonb $$;
    insert into periods values ('${period}', 'Current', 'open', '${group}', '2026-09-10'),
      ('${older}', 'Older', 'closed', '${group}', '2026-08-10');
    insert into people select ('10000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,
      'Member ' || i, 'active' from generate_series(1,8) i;
    insert into person_groups select id, '${group}', 'active' from people;
    insert into period_members select id, '${period}', id, 'fixed', false from people;
    insert into shuttle_expenses(period_id,buyer_id,total_amount,total_shuttle_count,buy_date) values
      ('${period}','${person(1)}',620000,24,'2026-09-15'),
      ('${period}','${person(2)}',310000,12,'2026-09-15'),
      ('${period}','${person(3)}',310000,12,'2026-09-15');
    insert into debts(period_id,person_id,debt_type,amount,status) values ('${older}','${person(4)}','shuttle_extra',127500,'unpaid');
    insert into club_fund_transactions(period_id,transaction_type,amount) values ('${period}','income',255000);
  `);
  for (const file of ["20260913_shuttle_discount_percent.sql", "20261006_shuttle_closeout_and_loans.sql"]) {
    await db.exec(await readFile(new URL(`../../supabase/${file}`, import.meta.url), "utf8"));
  }
  await db.exec(`update period_members set shuttle_discount_percent=50 where person_id in ('${person(7)}','${person(8)}')`);
  return db;
}

test("closeout: collect old debt, use surplus, weighted shares, conserve money and preserve history", async () => {
  const db = await fixture();
  try {
    const preview = async () => (await db.query("select preview_shuttle_period($1) as result", [period])).rows[0].result;
    const funding = (amount) => db.query("select apply_fund_to_shuttles($1,$2,$3)", [period, person(1), amount]);
    assert.equal((await preview()).can_settle, false);
    assert.equal((await preview()).unpaid_before_settlement.length, 1);
    await assert.rejects(() => funding(255000), /thu het/);
    await assert.rejects(() => db.query("select settle_shuttle_period($1)", [period]), /thu het/);
    await assert.rejects(() => db.query("update periods set status='closed' where id=$1", [period]), /chia cau/);
    await db.exec(`update debts set status='paid' where period_id='${older}'`);
    await assert.rejects(() => funding(255001), /vuot quy/);
    await funding(255000);
    const value = await preview();
    assert.equal(value.total_weight, 7);
    assert.equal(value.total_shuttle_amount, 985000);
    assert.equal(value.fund_balance, 0);
    assert.equal(value.can_settle, true);
    assert.equal(value.details.find((r) => r.person_id === person(1)).paid_for_shuttles, 365000);
    assert.ok(value.details.filter((r) => r.shuttle_discount_percent === 50).every((r) => r.shuttle_share === 70357));
    assert.equal(value.details.reduce((s, r) => s + r.shuttle_share, 0), 985000);
    assert.equal(value.details.reduce((s, r) => s + r.net_amount, 0), 0);
    await assert.rejects(() => db.exec("update shuttle_expenses set total_amount=100 where total_amount=365000"), /da bu tu quy/);
    // Two half shares still work without any full-weight payer.
    await db.exec("update period_members set shuttle_discount_percent=50");
    assert.equal((await preview()).total_weight, 4);
    assert.equal((await preview()).details.reduce((s, r) => s + r.shuttle_share, 0), 985000);
    await db.exec("update period_members set shuttle_discount_percent=100");
    await assert.rejects(preview, /chiu tien cau/);
    await db.exec(`update period_members set shuttle_discount_percent=case when person_id in ('${person(7)}','${person(8)}') then 50 else 0 end`);
    const saved = (await db.query("select settle_shuttle_period($1) as result", [period])).rows[0].result;
    assert.deepEqual(saved.preview_details, value.details);
    assert.equal(saved.allocation_method, "weighted_shares");
    assert.equal((await preview()).settled, true);
    await assert.rejects(() => db.query("select settle_shuttle_period($1)", [period]), /da chot/);
    await assert.rejects(() => funding(1), /truoc khi chot/);
    await assert.rejects(() => db.exec("update shuttle_expenses set total_amount=1"), /da chot/);
    await assert.rejects(() => db.exec("update period_members set shuttle_discount_percent=0"), /da chot/);
    const debtCount = Number((await db.query("select count(*) as count from debts where status='unpaid'")).rows[0].count);
    assert.ok(debtCount > 0);
    await db.query("update periods set status='closed' where id=$1", [period]);
    // Post-settlement shuttle debts are allowed to remain after closing.
    await db.query("insert into periods values ($1,'Next','open',$2,'2026-10-10')", [next, group]);
    await db.query("insert into club_fund_transactions(period_id,transaction_type,amount) values($1,'income',100)", [period]);
    assert.equal(Number((await db.query("select shuttle_fund_balance($1) as balance", [period])).rows[0].balance), 0);
    assert.equal(Number((await db.query("select shuttle_fund_balance($1) as balance", [next])).rows[0].balance), 100);
    await assert.rejects(() => db.query("insert into periods values (gen_random_uuid(),'Another','open',$1,'2026-11-10')", [group]), /dong ky/);
    await assert.rejects(() => db.query("update periods set status='open' where id=$1", [period]), /mo lai/);
    await assert.rejects(() => db.query("update periods set status='draft' where id=$1", [period]), /ban nhap/);
  } finally { await db.close(); }
});

test("settlement supports the real balance-offset trigger including a partially paid shuttle debt", async () => {
  const db = await fixture();
  try {
    const old = await readFile(new URL("../../supabase/20260814_automatic_balance_offset.sql", import.meta.url), "utf8");
    const start = old.indexOf("create or replace function public.offset_person_unpaid_debts");
    const end = old.indexOf("-- Keep the old RPC compatible", start);
    await db.exec(old.slice(start, end));
    await db.exec("update debts set status='paid'");
    await db.query("insert into person_balances(person_id,balance) values($1,10000)", [person(4)]);
    await db.query("select apply_fund_to_shuttles($1,$2,255000)", [period, person(1)]);
    const settled = (await db.query("select settle_shuttle_period($1) as result", [period])).rows[0].result;
    const item = settled.results.find((r) => r.person_id === person(4));
    assert.equal(item.action, "partially_paid_by_balance");
    assert.equal(item.remaining_amount, item.original_amount - 10000);
    assert.equal(Number((await db.query("select balance from person_balances where person_id=$1", [person(4)])).rows[0].balance), 0);
    assert.equal(Number((await db.query("select shuttle_fund_balance($1) as balance", [period])).rows[0].balance), 0);
  } finally { await db.close(); }
});

test("loans: own-group representative, full cash repayment exactly once, no charge in monthly shares", async () => {
  const db = await fixture();
  try {
    await db.exec("update debts set status='paid'");
    const create = (who, quantity = 3, price = 25000) => db.query(
      "select create_shuttle_loan($1,$2,$3,$4,'2026-09-20',null) as result", [period, who, quantity, price]);
    await assert.rejects(() => create(person(8), 0), /check constraint/);
    await assert.rejects(() => create(person(8), 1, 1.5), /check constraint/);
    await db.exec(`delete from person_groups where person_id='${person(8)}'`);
    await assert.rejects(() => create(person(8)), /thanh vien/);
    const loan = (await create(person(4))).rows[0].result;
    assert.equal(loan.amount, 75000);
    const before = (await db.query("select preview_shuttle_period($1) as result", [period])).rows[0].result;
    assert.equal(before.total_shuttle_amount, 1240000);
    assert.equal(before.unpaid_before_settlement[0].kind, "shuttle_loan");
    await assert.rejects(() => db.query("select settle_shuttle_period($1)", [period]), /thu het/);
    await db.query("select repay_shuttle_loan($1)", [loan.id]);
    await db.query("select repay_shuttle_loan($1)", [loan.id]);
    assert.equal(Number((await db.query("select shuttle_fund_balance($1) as balance", [period])).rows[0].balance), 330000);
    assert.equal(Number((await db.query("select count(*) as count from club_fund_transactions where description like '%shuttle_loan:%'")).rows[0].count), 1);
    await assert.rejects(() => db.query("select cancel_shuttle_loan($1)", [loan.id]), /da tra/);
    await assert.rejects(() => db.exec("delete from club_fund_transactions where description like '%shuttle_loan:%'"), /khong the/);
    const cancelled = (await create(person(5))).rows[0].result;
    await db.query("select cancel_shuttle_loan($1)", [cancelled.id]);
    await assert.rejects(() => db.query("select repay_shuttle_loan($1)", [cancelled.id]), /da huy/);
    await db.exec("set role authenticated");
    await assert.rejects(() => db.query("select repay_shuttle_loan($1)", [loan.id]), /permission denied/);
    await db.exec("reset role");
  } finally { await db.close(); }
});

test("manual collection and split-source purchase roll back both ledgers if either write fails", async () => {
  const db = await fixture();
  try {
    const debt = (await db.query("select id from debts where period_id=$1", [older])).rows[0].id;
    const deposit = (amount) => db.query("select deposit_fund_atomic($1,$2,$3,$4,null)", [period, person(4), amount, [debt]]);
    await assert.rejects(() => deposit(100000), /phai du/);
    await db.exec("alter table club_fund_transactions add constraint test_reject_income check(amount < 100000) not valid");
    await assert.rejects(() => deposit(127500), /check constraint/);
    assert.equal((await db.query("select status from debts where id=$1", [debt])).rows[0].status, "unpaid");
    await db.exec("alter table club_fund_transactions drop constraint test_reject_income");
    await deposit(127500);
    await assert.rejects(() => deposit(127500), /da tra/);
    assert.equal(Number((await db.query("select shuttle_fund_balance($1) as balance", [period])).rows[0].balance), 382500);
    const payload = { period_id: period, buyer_id: person(1), personal_amount: 10000, fund_amount: 25000,
      buy_type: "single", tube_count: 0, shuttle_per_tube: 12, single_count: 1, buy_date: "2026-09-20" };
    const purchase = () => db.query("select create_shuttle_expense_with_fund($1) as result", [payload]);
    await db.exec("alter table club_fund_transactions add constraint test_reject_split check(amount < 20000) not valid");
    await assert.rejects(purchase, /check constraint/);
    assert.equal(Number((await db.query("select count(*) as count from shuttle_expenses")).rows[0].count), 3);
    await db.exec("alter table club_fund_transactions drop constraint test_reject_split");
    const bought = (await purchase()).rows[0].result;
    assert.equal(bought.shuttle_expense.total_amount, 10000);
    assert.equal(bought.fund_transaction.amount, 25000);
  } finally { await db.close(); }
});
