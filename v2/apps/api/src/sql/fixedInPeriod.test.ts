// Chạy 20261116_v2_period_members.sql rồi 20261116_v2_fixed_means_in_period.sql trên PostgreSQL nhúng, dữ liệu giả.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sqlFile = (name: string) => readFileSync(new URL(`../../../../../supabase/${name}`, import.meta.url), "utf8");
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

test("in the open period means fixed: one status, mirrored on the profile", async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create type public.person_status as enum ('active','inactive','pending');
    create type public.period_status as enum ('draft','open','closed');
    create type public.period_member_status as enum ('fixed','guest','inactive');
    create type public.debt_type as enum ('monthly_fee','guest_fee','shuttle_extra','other');
    create type public.debt_status as enum ('unpaid','paid','cancelled');
    create table public.periods (id uuid primary key, name text, status public.period_status, group_id uuid, fixed_member_fee numeric default 0);
    create table public.people (id uuid primary key, status public.person_status, attendance_type text, updated_at timestamptz);
    create table public.person_groups (person_id uuid, group_id uuid, status public.person_status);
    create table public.period_members (id uuid primary key default gen_random_uuid(), period_id uuid, person_id uuid,
      status public.period_member_status, shuttle_discount_percent smallint default 0, updated_at timestamptz default now(),
      unique (period_id, person_id));
    create table public.debts (id uuid primary key default gen_random_uuid(), period_id uuid, person_id uuid, debt_type public.debt_type,
      amount numeric, status public.debt_status default 'unpaid', description text, created_at timestamptz default clock_timestamp(),
      updated_at timestamptz default now());
    create table public.shuttle_settlement_runs (period_id uuid primary key);
  `);
  const G = id(900);
  const [OPEN, DRAFT] = [id(901), id(902)];
  const [IN_BUT_GUEST, OUT_BUT_FIXED, NEW_GUEST, STAYS] = [id(1), id(2), id(3), id(4)];
  await db.exec(`
    insert into public.periods values ('${OPEN}', 'Mua 6', 'open', '${G}', 150000), ('${DRAFT}', 'Mua 7', 'draft', '${G}', 0);
    insert into public.people values ('${IN_BUT_GUEST}', 'active', 'guest'), ('${OUT_BUT_FIXED}', 'active', 'fixed'),
      ('${NEW_GUEST}', 'active', 'guest'), ('${STAYS}', 'active', 'fixed');
    insert into public.person_groups select id, '${G}', 'active' from public.people;
    insert into public.period_members (period_id, person_id, status) values ('${OPEN}', '${IN_BUT_GUEST}', 'fixed'), ('${OPEN}', '${STAYS}', 'fixed');
  `);
  await db.exec(sqlFile("20261116_v2_period_members.sql"));
  await db.exec(sqlFile("20261116_v2_fixed_means_in_period.sql"));
  await db.exec(sqlFile("20261116_v2_fixed_means_in_period.sql")); // chạy lại được

  const type = async (person: string) =>
    (await db.query<{ t: string }>(`select attendance_type t from public.people where id='${person}'`)).rows[0].t;
  // Đồng bộ một lần theo kỳ đang mở.
  assert.equal(await type(IN_BUT_GUEST), "fixed");
  assert.equal(await type(OUT_BUT_FIXED), "guest");
  assert.equal(await type(STAYS), "fixed");

  // Người hồ sơ vãng lai được thêm vào kỳ: vẫn vào là cố định, có phí, hồ sơ thành cố định.
  const added = (await db.query<{ r: { added: number; fees_created: number } }>("select public.v2_add_period_members($1, $2::uuid[]) r", [OPEN, [NEW_GUEST]])).rows[0].r;
  assert.deepEqual(added, { added: 1, skipped: 0, fees_created: 1 });
  assert.equal((await db.query<{ s: string }>(`select status::text s from public.period_members where person_id='${NEW_GUEST}'`)).rows[0].s, "fixed");
  assert.equal(await type(NEW_GUEST), "fixed");

  const member = async (person: string) => (await db.query<{ id: string }>(`select id from public.period_members where person_id='${person}' and period_id='${OPEN}'`)).rows[0].id;
  const update = (m: string, status: string) => db.query<{ r: { action: string } }>("select public.v2_update_period_member($1, $2, 0::smallint) r", [m, status]);

  // Rời kỳ: hủy phí chưa trả, hồ sơ thành vãng lai. Vào lại: phí mới, hồ sơ cố định.
  assert.equal((await update(await member(NEW_GUEST), "inactive")).rows[0].r.action, "fee_cancelled");
  assert.equal(await type(NEW_GUEST), "guest");
  assert.equal((await update(await member(NEW_GUEST), "fixed")).rows[0].r.action, "fee_created");
  assert.equal(await type(NEW_GUEST), "fixed");

  // Không còn trạng thái vãng lai trong kỳ.
  await assert.rejects(update(await member(STAYS), "guest"), /V2_INVALID_INPUT/);

  // Kỳ nháp: thêm vào là cố định trong kỳ đó, nhưng hồ sơ chỉ theo kỳ đang mở khi đổi trạng thái.
  await db.query("select public.v2_add_period_members($1, $2::uuid[])", [DRAFT, [OUT_BUT_FIXED]]);
  const draftMember = (await db.query<{ id: string }>(`select id from public.period_members where person_id='${OUT_BUT_FIXED}' and period_id='${DRAFT}'`)).rows[0].id;
  await update(draftMember, "inactive");
  assert.equal(await type(OUT_BUT_FIXED), "fixed"); // lúc thêm vào kỳ nháp đã thành cố định; rời kỳ nháp không đổi hồ sơ
});
