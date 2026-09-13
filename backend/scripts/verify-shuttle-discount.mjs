// Isolated PostgreSQL (PGlite) regression test. No production database access.
// npm install --prefix backend/node_modules/.shuttle-sql-test --no-save --package-lock=false @electric-sql/pglite
// node backend/scripts/verify-shuttle-discount.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../node_modules/.shuttle-sql-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
try {
  // Minimal schema fixture; offset is deliberately stubbed, not tested here.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table periods(id uuid primary key, name text, status text);
    create table people(id uuid primary key, full_name text);
    create table period_members(id uuid primary key, period_id uuid references periods,
      person_id uuid references people, status text, exempt_shuttle boolean default false);
    create table shuttle_expenses(period_id uuid references periods, buyer_id uuid references people,
      total_amount numeric, total_shuttle_count integer);
    create table shuttle_settlement_runs(period_id uuid primary key references periods,
      total_shuttle_amount numeric, share_per_member numeric, result jsonb default '{}');
    create table person_balances(person_id uuid primary key, balance numeric, updated_at timestamptz);
    create table balance_transactions(person_id uuid, period_id uuid, transaction_type text,
      amount numeric, direction text, description text);
    create table debts(id uuid primary key default gen_random_uuid(), period_id uuid,
      person_id uuid, debt_type text, amount numeric, status text, description text);
    create function offset_person_unpaid_debts(uuid) returns jsonb language sql
      as $$ select '{}'::jsonb $$;
    insert into periods values ('00000000-0000-0000-0000-000000000001', 'Test', 'open');
    insert into people select ('10000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,
      'Member ' || i from generate_series(1,10) i;
    insert into period_members select id, '00000000-0000-0000-0000-000000000001',
      id, 'fixed', false from people;
    insert into shuttle_expenses values ('00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002', 1000000, 12);
    update period_members set exempt_shuttle=true
      where person_id='10000000-0000-0000-0000-000000000010';
  `);
  await db.exec(await readFile(new URL("../../supabase/20260913_shuttle_discount_percent.sql", import.meta.url), "utf8"));
  const period = "00000000-0000-0000-0000-000000000001";
  assert.equal((await db.query("select shuttle_discount_percent from period_members where exempt_shuttle")).rows[0].shuttle_discount_percent,100);
  await db.exec("update period_members set shuttle_discount_percent=0");
  const person = (n) => `10000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
  const preview = async () => (await db.query("select preview_shuttle_period($1) as result", [period])).rows[0].result;
  const discount = (n, value) => db.query("update period_members set shuttle_discount_percent=$1 where person_id=$2", [value, person(n)]);
  const conserved = (value) => {
    assert.equal(value.details.reduce((sum, row) => sum + row.shuttle_share, 0), value.total_shuttle_amount);
    assert.equal(value.details.reduce((sum, row) => sum + row.net_amount, 0), 0);
  };
  let result = await preview();
  assert.ok(result.details.every((row) => row.shuttle_share === 100000));
  await discount(1, 50);
  result = await preview();
  assert.equal(result.details.find((row) => row.person_id === person(1)).shuttle_share, 50000);
  assert.ok(result.details.filter((row) => row.person_id !== person(1))
    .every((row) => [105555,105556].includes(row.shuttle_share)));
  conserved(result);
  await discount(3, 50);
  result = await preview();
  assert.equal(result.details.find((row) => row.person_id === person(2)).shuttle_share,112500);
  conserved(result);
  // Fully exempt buyer retains the entire amount advanced.
  await discount(2, 100);
  result = await preview();
  assert.equal(result.details.find((row) => row.person_id === person(2)).net_amount,1000000);
  conserved(result);
  await db.exec("update period_members set shuttle_discount_percent=50");
  await assert.rejects(preview, /Can it nhat/);
  await db.exec("update shuttle_expenses set total_amount=0");
  result = await preview();
  conserved(result);
  await db.exec("update shuttle_expenses set total_amount=1000001; update period_members set shuttle_discount_percent=0");
  await discount(1,50);
  result = await preview();
  conserved(result);
  await assert.rejects(() => discount(1,25), /check constraint/);
  // A buyer no longer enrolled as fixed still receives their credit.
  await db.query("update period_members set status='guest' where person_id=$1", [person(2)]);
  result = await preview();
  assert.equal(result.details.find((row) => row.person_id === person(2)).net_amount,1000001);
  conserved(result);
  const settled = (await db.query("select settle_shuttle_period($1) as result", [period])).rows[0].result;
  assert.deepEqual(settled.preview_details, result.details);
  const balances = (await db.query("select sum(balance)::float8 as total from person_balances")).rows[0].total;
  const debts = (await db.query("select sum(amount)::float8 as total from debts")).rows[0].total;
  assert.equal(balances,debts);
  await assert.rejects(() => db.query("select settle_shuttle_period($1)",[period]), /da chot/);
  await assert.rejects(() => discount(1,0), /da chot/);
  await assert.rejects(() => db.query("update period_members set exempt_shuttle=true where person_id=$1",[person(3)]), /da chot/);
  await assert.rejects(() => db.query("delete from period_members where person_id=$1",[person(1)]), /da chot/);
  assert.equal((await preview()).settled,true);
  assert.deepEqual((await preview()).details, result.details);
  console.log("PASS: SQL migration, allocation, rounding, exempt buyer credit, settlement conservation, retry and locking.");
} finally {
  await db.close();
}
