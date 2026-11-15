// Chạy migration 20261116_v2_guest_attendance.sql trên PostgreSQL nhúng (PGlite) với schema tối thiểu, dữ liệu giả.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sqlFile = (name: string) => readFileSync(new URL(`../../../../../supabase/${name}`, import.meta.url), "utf8");
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

test("v2 guest attendance functions keep guests and guest fees in step, and never drop a paid fee", async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create type public.person_status as enum ('active','inactive','pending');
    create type public.period_status as enum ('draft','open','closed');
    create type public.debt_type as enum ('monthly_fee','guest_fee','shuttle_extra','other');
    create type public.debt_status as enum ('unpaid','paid','cancelled');
    create table public.periods (id uuid primary key, name text, status public.period_status, group_id uuid, guest_fee_per_session numeric default 0);
    create table public.people (id uuid primary key, status public.person_status);
    create table public.person_groups (person_id uuid, group_id uuid, status public.person_status);
    create table public.badminton_sessions (id uuid primary key, period_id uuid, play_date date);
    create table public.guest_attendances (id uuid primary key default gen_random_uuid(), session_id uuid, person_id uuid,
      amount numeric default 0, note text, updated_at timestamptz default now());
    create table public.debts (id uuid primary key default gen_random_uuid(), period_id uuid, person_id uuid, debt_type public.debt_type,
      amount numeric, status public.debt_status default 'unpaid', description text,
      source_attendance_id uuid references public.guest_attendances(id) on delete set null,
      created_at timestamptz default clock_timestamp(), updated_at timestamptz default now());
    create table public.shuttle_settlement_runs (period_id uuid primary key);
  `);
  const sql = sqlFile("20261116_v2_guest_attendance.sql");
  await db.exec(sql);
  await db.exec(sql);

  const G = id(900);
  const [OPEN, CLOSED, SETTLED] = [id(901), id(902), id(903)];
  const [S, S_CLOSED, S_SETTLED] = [id(911), id(912), id(913)];
  const [LAN, MINH, OUT, REST] = [id(1), id(2), id(3), id(4)];
  await db.exec(`
    insert into public.periods values ('${OPEN}', 'Mua 7', 'open', '${G}', 30000), ('${CLOSED}', 'Mua 5', 'closed', '${G}', 30000),
      ('${SETTLED}', 'Mua 6', 'open', '${G}', 30000);
    insert into public.shuttle_settlement_runs values ('${SETTLED}');
    insert into public.badminton_sessions values ('${S}', '${OPEN}', '2026-12-12'), ('${S_CLOSED}', '${CLOSED}', '2026-10-01'),
      ('${S_SETTLED}', '${SETTLED}', '2026-11-20');
    insert into public.people values ('${LAN}', 'active'), ('${MINH}', 'active'), ('${OUT}', 'active'), ('${REST}', 'inactive');
    insert into public.person_groups values ('${LAN}', '${G}', 'active'), ('${MINH}', '${G}', 'active'), ('${OUT}', '${id(999)}', 'active'),
      ('${REST}', '${G}', 'active');
  `);

  const call = async (text: string, params: unknown[]): Promise<{ ok: boolean; value?: Record<string, unknown>; error?: string }> => {
    try {
      return { ok: true, value: (await db.query<{ r: Record<string, unknown> }>(text, params)).rows[0].r };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  };
  const add = (session: string, person: string, amount: number, note: string | null = null) =>
    call("select public.v2_add_guest_attendance($1, $2, $3, $4) as r", [session, person, amount, note]);
  const update = (attendance: string, amount: number, note: string | null = null) =>
    call("select public.v2_update_guest_attendance($1, $2, $3) as r", [attendance, amount, note]);
  const remove = (attendance: string) => call("select public.v2_remove_guest_attendance($1) as r", [attendance]);
  const debts = async (person: string) =>
    (await db.query<{ amount: string; status: string; description: string }>(
      `select amount::text, status::text, description from debts where person_id='${person}' order by created_at`,
    )).rows;

  // Thêm khách có phí: một khoản nợ phí khách gắn đúng buổi.
  const lan = await add(S, LAN, 30000, "  bạn của Minh ");
  assert.equal(lan.ok, true, lan.error);
  const lanId = lan.value!.attendance_id as string;
  assert.deepEqual((await debts(LAN)).map((d) => [d.amount, d.status]), [["30000", "unpaid"]]);
  assert.match((await debts(LAN))[0].description, /Mua 7 ngay 2026-12-12 \[guest_attendance:/);
  assert.equal((await db.query<{ note: string }>(`select note from guest_attendances where id='${lanId}'`)).rows[0].note, "bạn của Minh");
  // Khách miễn phí: không có nợ.
  assert.equal((await add(S, MINH, 0)).value!.fee_created, false);
  assert.equal((await debts(MINH)).length, 0);

  // Từ chối: trùng người, ngoài nhóm, đã nghỉ, số tiền lạ, kỳ đóng, kỳ đã chốt.
  assert.match((await add(S, LAN, 30000)).error ?? "", /V2_ALREADY_IN_SESSION/);
  assert.match((await add(S, OUT, 30000)).error ?? "", /V2_PERSON_NOT_IN_GROUP/);
  assert.match((await add(S, REST, 30000)).error ?? "", /V2_PERSON_NOT_IN_GROUP/);
  assert.match((await add(S, OUT, -1)).error ?? "", /V2_INVALID_AMOUNT/);
  assert.match((await add(S, OUT, 1.5)).error ?? "", /V2_INVALID_AMOUNT/);
  assert.match((await add(S_CLOSED, LAN, 30000)).error ?? "", /V2_PERIOD_NOT_OPEN/);
  assert.match((await add(S_SETTLED, LAN, 30000)).error ?? "", /V2_PERIOD_SETTLED/);

  // Đổi số tiền: hủy nợ cũ chưa trả, tạo nợ mới. Về 0: chỉ hủy.
  assert.equal((await update(lanId, 50000)).value!.fee_changed, true);
  assert.deepEqual((await debts(LAN)).map((d) => [d.amount, d.status]), [["30000", "cancelled"], ["50000", "unpaid"]]);
  assert.equal((await update(lanId, 50000, "đổi ghi chú")).value!.fee_changed, false);
  assert.equal((await debts(LAN)).length, 2);
  await update(lanId, 0);
  assert.deepEqual((await debts(LAN)).map((d) => d.status), ["cancelled", "cancelled"]);

  // Khách đã trả: không đổi số tiền, không xóa được; nợ đã trả còn nguyên.
  await update(lanId, 40000);
  await db.exec(`update debts set status='paid' where person_id='${LAN}' and status='unpaid'`);
  assert.match((await update(lanId, 20000)).error ?? "", /V2_GUEST_FEE_PAID/);
  assert.match((await remove(lanId)).error ?? "", /V2_GUEST_FEE_PAID/);
  assert.equal((await debts(LAN)).filter((d) => d.status === "paid").length, 1);
  // Đổi ghi chú vẫn được.
  assert.equal((await update(lanId, 40000, "đã trả")).ok, true);

  // Xóa khách chưa trả: hủy nợ, xóa dòng điểm danh.
  const minhAgain = (await add(S, MINH, 0)).ok; // đã có trong buổi: từ chối
  assert.equal(minhAgain, false);
  const minhId = (await db.query<{ id: string }>(`select id from guest_attendances where person_id='${MINH}'`)).rows[0].id;
  await update(minhId, 30000);
  assert.equal((await remove(minhId)).value!.fee_cancelled, true);
  assert.deepEqual((await debts(MINH)).map((d) => d.status), ["cancelled"]);
  assert.equal(Number((await db.query<{ n: number }>(`select count(*) n from guest_attendances where person_id='${MINH}'`)).rows[0].n), 0);

  // Trình duyệt không gọi được hàm.
  for (const fn of ["v2_add_guest_attendance(uuid, uuid, numeric, text)", "v2_remove_guest_attendance(uuid)", "v2_guest_period_for_session(uuid)"]) {
    for (const role of ["anon", "authenticated"]) {
      const allowed = (await db.query<{ a: boolean }>(`select has_function_privilege('${role}', 'public.${fn}', 'execute') a`)).rows[0].a;
      assert.equal(allowed, false, `${role} ${fn}`);
    }
  }
});
