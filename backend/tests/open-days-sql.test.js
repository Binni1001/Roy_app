import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test("open day SQL: authorization, eight seats, cancellation, deadlines and private tables", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const group = id(1), other = id(2), period = id(3), otherPeriod = id(4), admin = id(5);
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
    create table periods(id uuid primary key, group_id uuid, status text, start_date date, end_date date);
    create table people(id uuid primary key, email text, status text);
    create table person_groups(person_id uuid references people(id), group_id uuid, status text, member_role text);
    insert into periods values ('${period}','${group}','open','2099-01-01','2099-12-31'), ('${otherPeriod}','${other}','open','2099-01-01','2099-12-31');
    insert into auth.users values ('${admin}','admin@test.invalid','{"role":"admin","managed_group_ids":["${group}"]}');
  `);
  for (let n = 10; n <= 18; n++) {
    await db.query("insert into auth.users values ($1,$2,'{}');", [id(n), `p${n}@test.invalid`]);
    await db.query("insert into people values ($1,$2,'active');", [id(n), `p${n}@test.invalid`]);
    await db.query("insert into person_groups values ($1,$2,'active','member');", [id(n), group]);
  }
  const sql = await readFile(new URL('../../supabase/20260929_open_play_days.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  const mutate = (actor, action, date = '2099-09-10', p = period) => db.query("select mutate_open_play_day($1,$2,$3,$4,$5)", [p, date, actor, action, 'Giao lưu']);
  const count = async () => Number((await db.query('select count(*) from open_play_registrations')).rows[0].count);
  await t.test('admin scope and self identity are enforced inside SQL', async () => {
    await assert.rejects(mutate(id(10), 'open'), { code: '42501' });
    await assert.rejects(mutate(admin, 'open', '2099-09-10', otherPeriod), { code: '42501' });
    await mutate(admin, 'open');
    await mutate(admin, 'open');
    assert.equal((await db.query('select * from open_play_days')).rows.length, 1);
    await assert.rejects(mutate(admin, 'join'), { code: '42501' });
    await assert.rejects(mutate(id(10), 'join', '2099-09-10', otherPeriod), { code: '42501' });
  });
  await t.test('nine competing requests grant eight seats; retries cannot double book', async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 9 }, (_, n) => mutate(id(n + 10), 'join')));
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 8);
    assert.equal(outcomes.find(r => r.status === 'rejected').reason.message, 'OPEN_DAY_FULL');
    assert.equal(await count(), 8);
    await mutate(id(10), 'join');
    assert.equal(await count(), 8);
  });
  await t.test('closure retains roster, allows self cancel, reopening restores availability', async () => {
    await mutate(admin, 'close');
    assert.equal(await count(), 8);
    await assert.rejects(mutate(id(18), 'join'), { code: '22023' });
    await mutate(id(10), 'leave');
    await mutate(id(10), 'leave');
    assert.equal(await count(), 7);
    await mutate(admin, 'reopen');
    await mutate(id(18), 'join');
    assert.equal(await count(), 8);
  });
  await t.test('revoked membership/admin assignment and closed periods fail closed', async () => {
    await db.query("update person_groups set status='inactive' where person_id=$1", [id(11)]);
    await assert.rejects(mutate(id(11), 'leave'), { code: '42501' });
    await db.query("update auth.users set raw_app_meta_data='{" + '"role":"admin"' + "}' where id=$1", [admin]);
    await assert.rejects(mutate(admin, 'close'), { code: '42501' });
    await db.query("update periods set status='closed' where id=$1", [period]);
    await assert.rejects(mutate(id(12), 'leave'), { code: '22023' });
    await db.query("update periods set status='open' where id=$1", [period]);
    await assert.rejects(mutate(id(12), 'join', '2100-01-01'), { code: '22023' });
  });
  await t.test('past dates reject registration and cancellation in database timezone', async () => {
    await db.query("update periods set start_date='2000-01-01' where id=$1", [period]);
    await assert.rejects(mutate(id(12), 'join', '2000-01-01'), { code: '22023' });
    await assert.rejects(mutate(id(12), 'leave', '2000-01-01'), { code: '22023' });
  });
  await t.test('rerunnable migration preserves seats and browser roles cannot bypass RPC', async () => {
    await db.exec(sql);
    assert.equal(await count(), 8);
    await db.exec('set role authenticated');
    await assert.rejects(mutate(id(12), 'leave'), { code: '42501' });
    await assert.rejects(db.query('select * from open_play_registrations'), { code: '42501' });
    await db.exec('reset role; set role service_role');
    await assert.rejects(db.query('delete from open_play_registrations'), { code: '42501' });
    await db.exec('reset role');
  });
});
