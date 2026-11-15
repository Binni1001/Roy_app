// Chạy migration 20261116_v2_period_members.sql trên PostgreSQL nhúng với schema tối thiểu và dữ liệu giả.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sqlFile = (name: string) => readFileSync(new URL(`../../../../../supabase/${name}`, import.meta.url), "utf8");

test("v2 period member functions keep members and fixed fees in step", async () => {
  const db = new PGlite();

  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create type public.person_status as enum ('active','inactive','pending');
    create type public.period_status as enum ('draft','open','closed');
    create type public.period_member_status as enum ('fixed','guest','inactive');
    create type public.debt_type as enum ('monthly_fee','guest_fee','shuttle_extra','other');
    create type public.debt_status as enum ('unpaid','paid','cancelled');
    create table public.periods (id uuid primary key, name text, status public.period_status, group_id uuid, fixed_member_fee numeric default 0);
    create table public.people (id uuid primary key, status public.person_status, attendance_type text);
    create table public.person_groups (person_id uuid, group_id uuid, status public.person_status);
    create table public.period_members (id uuid primary key default gen_random_uuid(), period_id uuid, person_id uuid,
      status public.period_member_status, shuttle_discount_percent smallint default 0, exempt_shuttle boolean default false,
      updated_at timestamptz default now(), unique (period_id, person_id));
    create table public.debts (id uuid primary key default gen_random_uuid(), period_id uuid, person_id uuid, debt_type public.debt_type,
      amount numeric, status public.debt_status default 'unpaid', description text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.shuttle_settlement_runs (period_id uuid primary key);
    create table public.offset_calls (person_id uuid);
    -- Bản rút gọn của trigger tự bù số dư: ghi lại để kiểm tra trigger vẫn được gọi.
    create function public.auto_offset_new_debt() returns trigger language plpgsql as $$
    begin if new.status = 'unpaid' and new.amount > 0 then insert into public.offset_calls values (new.person_id); end if; return new; end $$;
    create trigger debts_auto_offset_after_insert after insert on public.debts for each row execute function public.auto_offset_new_debt();
    -- Bản rút gọn của guard_shuttle_discount: kỳ đã chốt thì không thêm, không đổi trạng thái hay mức miễn.
    create function public.guard_shuttle_discount() returns trigger language plpgsql as $$
    begin
      if exists (select 1 from public.shuttle_settlement_runs where period_id = new.period_id) then
        if tg_op = 'INSERT' or new.status <> old.status or new.shuttle_discount_percent <> old.shuttle_discount_percent then
          raise exception 'Ky da chot chia cau';
        end if;
      end if;
      return new;
    end $$;
    create trigger period_members_shuttle_discount_guard before insert or update on public.period_members
      for each row execute function public.guard_shuttle_discount();
  `);
  const sql = sqlFile("20261116_v2_period_members.sql");
  await db.exec(sql);
  await db.exec(sql); // chạy lại được

  const G = "00000000-0000-0000-0000-00000000000a";
  const OTHER_G = "00000000-0000-0000-0000-00000000000b";
  const K = "00000000-0000-0000-0000-0000000000a1";
  const CLOSED = "00000000-0000-0000-0000-0000000000a2";
  const SETTLED = "00000000-0000-0000-0000-0000000000a3";
  const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const [FIXED, GUEST, RESTING, OUTSIDER, PAID] = [1, 2, 3, 4, 5].map(id);

  await db.exec(`
    insert into public.periods values ('${K}', 'Mua 7', 'open', '${G}', 150000), ('${CLOSED}', 'Mua 1', 'closed', '${G}', 150000),
      ('${SETTLED}', 'Mua 6', 'open', '${G}', 150000);
    insert into public.shuttle_settlement_runs values ('${SETTLED}');
    insert into public.people values ('${FIXED}', 'active', 'fixed'), ('${GUEST}', 'active', 'guest'), ('${RESTING}', 'inactive', 'fixed'),
      ('${OUTSIDER}', 'active', 'fixed'), ('${PAID}', 'active', 'fixed');
    insert into public.person_groups values ('${FIXED}', '${G}', 'active'), ('${GUEST}', '${G}', 'active'), ('${RESTING}', '${G}', 'inactive'),
      ('${OUTSIDER}', '${OTHER_G}', 'active'), ('${PAID}', '${G}', 'active');
  `);

  const call = async (sqlText: string, params: unknown[]): Promise<{ ok: boolean; value?: any; error?: string }> => {
    try {
      return { ok: true, value: (await db.query(sqlText, params)).rows[0] };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  };
  const add = (period: string, ids: string[]) => call("select public.v2_add_period_members($1, $2::uuid[]) as r", [period, ids]);
  const update = (member: string, status: string, discount: number) => call("select public.v2_update_period_member($1, $2, $3::smallint) as r", [member, status, discount]);
  const count = async (q: string) => Number((await db.query<{ n: number }>(q)).rows[0].n);

  // Thêm cố định + vãng lai: tạo đúng một khoản phí cho người cố định, trigger bù số dư được gọi.
  let r = await add(K, [FIXED, GUEST, FIXED]);
  assert.deepEqual(r.value.r, { added: 2, skipped: 0, fees_created: 1 });
  assert.equal(await count(`select count(*) n from debts where person_id='${FIXED}' and debt_type='monthly_fee' and amount=150000`), 1);
  assert.equal(await count(`select count(*) n from offset_calls where person_id='${FIXED}'`), 1);
  assert.equal((await db.query<{ s: string }>(`select status::text s from period_members where person_id='${GUEST}'`)).rows[0].s, "guest");
  // Thêm lại: bỏ qua, không tạo nợ trùng.
  assert.deepEqual((await add(K, [FIXED])).value.r, { added: 0, skipped: 1, fees_created: 0 });

  // Người đã nghỉ, người nhóm khác, id lạ: cả lô bị từ chối, không ghi gì.
  for (const bad of [[PAID, RESTING], [PAID, OUTSIDER], [PAID, id(99)]]) {
    r = await add(K, bad);
    assert.equal(r.ok, false, bad.join());
  }
  assert.equal(await count(`select count(*) n from period_members where person_id='${PAID}'`), 0);
  // Kỳ đã đóng hoặc đã chốt chia cầu: từ chối.
  assert.match((await add(CLOSED, [PAID])).error ?? "", /V2_PERIOD_CLOSED/);
  assert.match((await add(SETTLED, [PAID])).error ?? "", /V2_PERIOD_SETTLED/);
  assert.equal((await add(K, [])).ok, false);

  const memberOf = async (person: string, period = K) =>
    (await db.query<{ id: string }>(`select id from period_members where person_id='${person}' and period_id='${period}'`)).rows[0].id;

  // Cố định -> vãng lai: hủy phí chưa trả. Vãng lai -> cố định: tạo phí mới.
  const fixedMember = await memberOf(FIXED);
  assert.equal((await update(fixedMember, "guest", 0)).value.r.action, "fee_cancelled");
  assert.equal(await count(`select count(*) n from debts where person_id='${FIXED}' and status='cancelled'`), 1);
  assert.equal((await update(fixedMember, "fixed", 50)).value.r.action, "fee_created");
  assert.equal(await count(`select count(*) n from debts where person_id='${FIXED}' and status='unpaid'`), 1);
  assert.equal((await db.query<{ d: number }>(`select shuttle_discount_percent d from period_members where id='${fixedMember}'`)).rows[0].d, 50);
  // Chỉ đổi mức miễn: không đụng nợ.
  assert.equal((await update(fixedMember, "fixed", 100)).value.r.action, "none");

  // Phí đã trả: giữ nguyên, báo cần hoàn tiền.
  await add(K, [PAID]);
  await db.exec(`update debts set status='paid' where person_id='${PAID}'`);
  assert.equal((await update(await memberOf(PAID), "inactive", 0)).value.r.action, "fee_paid_refund_needed");
  assert.equal(await count(`select count(*) n from debts where person_id='${PAID}' and status='paid'`), 1);

  // Đầu vào sai.
  assert.equal((await update(fixedMember, "vip", 0)).ok, false);
  assert.equal((await update(fixedMember, "fixed", 30)).ok, false);
  assert.equal((await update(id(98), "fixed", 0)).ok, false);

  // Kỳ đã chốt: trigger có sẵn chặn đổi trạng thái, và cả giao dịch hủy theo (không tạo nợ lẻ).
  await db.exec(`delete from shuttle_settlement_runs where period_id='${SETTLED}'`);
  await db.exec(`insert into period_members (period_id, person_id, status) values ('${SETTLED}', '${GUEST}', 'guest')`);
  await db.exec(`insert into shuttle_settlement_runs values ('${SETTLED}')`);
  const settledMember = await memberOf(GUEST, SETTLED);
  r = await update(settledMember, "fixed", 0);
  assert.equal(r.ok, false);
  assert.equal(await count(`select count(*) n from debts where period_id='${SETTLED}'`), 0);

  // Trình duyệt (anon, authenticated) không gọi được hàm.
  for (const role of ["anon", "authenticated"]) {
    const allowed = (await db.query<{ a: boolean }>(`select has_function_privilege('${role}', 'public.v2_add_period_members(uuid, uuid[])', 'execute') a`)).rows[0].a;
    assert.equal(allowed, false, role);
  }
  assert.equal((await db.query<{ a: boolean }>(`select has_function_privilege('service_role', 'public.v2_update_period_member(uuid, text, smallint)', 'execute') a`)).rows[0].a, true);

  // console.log("v2 period members: all checks passed");
});
