import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const Q = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const U = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const V = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const OWNER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";

test("planning migration and RPC run against isolated PostgreSQL with synthetic data only", async (t) => {
  const db = new PGlite(); // In-memory; never loads .env or contacts Supabase.
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
    create table public.groups(id uuid primary key);
    create table public.periods(id uuid primary key, group_id uuid references groups(id), status text, start_date date, end_date date);
    create table public.people(id uuid primary key, email text, status text);
    create table public.person_groups(person_id uuid references people(id), group_id uuid references groups(id), status text, member_role text);
    create table public.period_members(period_id uuid references periods(id), person_id uuid references people(id), status text);
    insert into groups values ('${A}'), ('${B}');
    insert into periods values ('${P}', '${A}', 'open', '2026-09-01', '2026-09-30'), ('${Q}', '${B}', 'open', '2026-09-01', '2026-09-30');
    insert into auth.users values
      ('${OWNER}', 'owner@example.test', '{"role":"owner"}'),
      ('${ADMIN}', 'admin@example.test', '{"role":"admin","managed_group_ids":["${A}"]}'),
      ('${U}', 'a@example.test', '{"role":"user"}'), ('${V}', 'b@example.test', '{"role":"user"}');
    insert into people values ('${U}', 'a@example.test', 'active'), ('${V}', 'b@example.test', 'active'), ('${ADMIN}', 'admin@example.test', 'active');
    insert into person_groups values ('${U}', '${A}', 'active', 'member'), ('${V}', '${A}', 'active', 'member'),
      ('${V}', '${B}', 'active', 'member'), ('${ADMIN}', '${A}', 'active', 'member');
    insert into period_members values ('${P}', '${U}', 'fixed'), ('${P}', '${V}', 'fixed'), ('${Q}', '${V}', 'fixed'), ('${P}', '${ADMIN}', 'fixed');
  `);
  const sql = await readFile(new URL("../../supabase/20260923_session_planning_preferences.sql", import.meta.url), "utf8");
  await db.exec(sql);
  const save = (person, actor, revision, busy = [], overrides = {}, period = P) => db.query(
    "select * from public.save_session_planning_preferences($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::smallint[],$6::jsonb)",
    [period, person, actor, revision, `{${busy.join(",")}}`, JSON.stringify(overrides)]
  );
  const asRole = async (role, action) => {
    await db.exec(`set role ${role}`);
    try { return await action(); } finally { await db.exec("reset role"); }
  };

  await t.test("self save creates one revision and one audit; rerunning migration preserves data", async () => {
    const result = await asRole("service_role", () => save(U, U, 0, [3, 1, 1], { "2026-09-07": "available" }));
    assert.equal(result.rows[0].revision, 1);
    assert.deepEqual(result.rows[0].busy_weekdays, [1, 3]);
    await db.exec(sql);
    const audit = await db.query("select revision, actor_id, before_value from session_planning_preference_audits");
    assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].actor_id, U); assert.equal(audit.rows[0].before_value, null);
  });

  await t.test("stale writes cannot overwrite; only one request with the same revision succeeds", async () => {
    const results = await Promise.allSettled([save(U, ADMIN, 1, [2]), save(U, U, 1, [5])]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.code, "40001");
    const audits = await db.query("select * from session_planning_preference_audits where person_id=$1", [U]);
    assert.equal(audits.rows.length, 2);
  });

  await t.test("database enforces self, scoped admins, active players and fixed membership", async () => {
    await assert.rejects(save(V, U, 0), { code: "42501" });
    await assert.rejects(save(V, ADMIN, 0, [], {}, Q), { code: "42501" });
    await assert.rejects(save(ADMIN, OWNER, 0), { code: "42501" });
    await db.query("update people set status='inactive' where id=$1", [V]);
    await assert.rejects(save(V, OWNER, 0), { code: "42501" });
    await db.query("update people set status=null where id=$1", [V]);
    await assert.rejects(save(V, OWNER, 0), { code: "42501" });
    await db.query("update people set status='active' where id=$1", [V]);
    await db.query("update period_members set status='guest' where person_id=$1 and period_id=$2", [V, P]);
    await assert.rejects(save(V, OWNER, 0), { code: "42501" });
    await db.query("update period_members set status='fixed' where person_id=$1 and period_id=$2", [V, P]);
    await db.query("update person_groups set status='inactive' where person_id=$1 and group_id=$2", [V, A]);
    await assert.rejects(save(V, OWNER, 0), { code: "42501" });
    await db.query("update person_groups set status='active' where person_id=$1 and group_id=$2", [V, A]);
  });

  await t.test("revoked assignments and inactive admins are rejected at the database too", async () => {
    await db.query("update auth.users set raw_app_meta_data='{}'::jsonb where id=$1", [ADMIN]);
    await assert.rejects(save(V, ADMIN, 0), { code: "42501" });
    await db.query("update auth.users set raw_app_meta_data=$2::jsonb where id=$1", [ADMIN, JSON.stringify({ role: "admin", managed_group_ids: [A] })]);
    await db.query("update people set status='inactive' where id=$1", [ADMIN]);
    await assert.rejects(save(V, ADMIN, 0), { code: "42501" });
    await db.query("update people set status='active' where id=$1", [ADMIN]);
  });

  await t.test("closed periods and invalid calendars cannot mutate data", async () => {
    await db.query("update periods set status='closed' where id=$1", [P]);
    await assert.rejects(save(V, OWNER, 0), { code: "22023" });
    await db.query("update periods set status=null where id=$1", [P]);
    await assert.rejects(save(V, OWNER, 0), { code: "22023" });
    await db.query("update periods set status='open' where id=$1", [P]);
    for (const overrides of [{ "2026-09-31": "busy" }, { "2026-10-01": "busy" }, { "2026-09-03": "other" }]) {
      await assert.rejects(save(V, OWNER, 0, [], overrides), { code: "22023" });
    }
    await assert.rejects(save(V, OWNER, 0, [8]), { code: "22023" });
    assert.equal((await db.query("select * from session_planning_preferences where person_id=$1", [V])).rows.length, 0);
  });

  await t.test("anonymous/authenticated callers cannot read calendars or call privileged RPC", async () => {
    for (const role of ["anon", "authenticated"]) {
      await asRole(role, async () => {
        await assert.rejects(db.query("select * from session_planning_preferences"), { code: "42501" });
        await assert.rejects(save(V, OWNER, 0), { code: "42501" });
      });
    }
    await asRole("service_role", async () => {
      await assert.rejects(db.query("delete from session_planning_preferences"), { code: "42501" });
      await assert.rejects(db.query("update session_planning_preferences set revision=99"), { code: "42501" });
    });
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='session_planning_preferences'")).rows[0].relrowsecurity, true);
  });

  await t.test("audit failure rolls back the preference write; no partially saved state", async () => {
    await db.exec(`create function public.planning_test_fail() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end $$;
      create trigger planning_test_fail before insert on public.session_planning_preference_audits for each row execute function public.planning_test_fail();`);
    await assert.rejects(save(V, OWNER, 0), /test audit failure/);
    assert.equal((await db.query("select * from session_planning_preferences where person_id=$1", [V])).rows.length, 0);
    await db.exec("drop trigger planning_test_fail on public.session_planning_preference_audits; drop function public.planning_test_fail();");
  });

  await t.test("same person in two clubs keeps independent preferences; no old business rows change", async () => {
    await save(V, ADMIN, 0, [1]);
    await save(V, OWNER, 0, [2], {}, Q);
    const rows = await db.query("select period_id, busy_weekdays from session_planning_preferences where person_id=$1 order by period_id", [V]);
    assert.deepEqual(rows.rows.map((row) => row.busy_weekdays), [[1], [2]]);
    assert.equal((await db.query("select count(*)::int as n from period_members")).rows[0].n, 4);
    assert.doesNotMatch(sql, /(?:insert into|update|delete from)\s+(?:public\.)?(?:debts|payments|badminton_sessions)\b/i);
  });

  const profilesSql = await readFile(new URL("../../supabase/20260923_session_planning_profiles.sql", import.meta.url), "utf8");
  const preferencesBefore = (await db.query("select * from session_planning_preferences order by period_id, person_id")).rows;
  await db.exec(profilesSql);
  const saveProfile = (person, actor, revision, level = null, partner = null, period = P) => db.query(
    "select * from public.save_session_planning_profile($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::smallint,$6::uuid)",
    [period, person, actor, revision, level, partner]
  );

  await t.test("profile migration saves manual levels/pairs with atomic audit, reruns safely and leaves preferences intact", async () => {
    const saved = await asRole("service_role", () => saveProfile(U, ADMIN, 0, 2, V));
    assert.equal(saved.rows[0].level, 2); assert.equal(saved.rows[0].preferred_partner_id, V);
    assert.equal(saved.rows[0].revision, 1);
    await db.exec(profilesSql);
    const audit = (await db.query("select * from session_planning_profile_audits")).rows;
    assert.equal(audit.length, 1); assert.equal(audit[0].actor_id, ADMIN); assert.equal(audit[0].before_value, null);
    assert.equal((await db.query("select * from session_planning_profiles where person_id=$1", [V])).rows.length, 0);
    assert.deepEqual((await db.query("select * from session_planning_preferences order by period_id, person_id")).rows, preferencesBefore);
    assert.doesNotMatch(profilesSql, /(?:insert into|update|delete from)\s+(?:public\.)?(?:debts|payments|badminton_sessions|session_planning_preferences)\b/i);
  });

  await t.test("profile RPC rechecks owner/admin scope and rejects ordinary or forged actors", async () => {
    for (const actor of [U, V, "00000000-0000-4000-8000-000000000000"]) {
      await assert.rejects(saveProfile(V, actor, 0, 1), { code: "42501" });
    }
    await assert.rejects(saveProfile(V, ADMIN, 0, 1, null, Q), { code: "42501" });
    await db.query("update auth.users set raw_app_meta_data='{}'::jsonb where id=$1", [ADMIN]);
    await assert.rejects(saveProfile(V, ADMIN, 0, 1), { code: "42501" });
    await db.query("update auth.users set raw_app_meta_data=$2::jsonb where id=$1", [ADMIN, JSON.stringify({ role: "admin", managed_group_ids: [A] })]);
    await db.query("update people set status='inactive' where id=$1", [ADMIN]);
    await assert.rejects(saveProfile(V, ADMIN, 0, 1), { code: "42501" });
    await db.query("update people set status='active' where id=$1", [ADMIN]);
  });

  await t.test("both profile subject and preferred partner must remain eligible fixed players", async () => {
    await assert.rejects(saveProfile(ADMIN, OWNER, 0, 2), { code: "42501" });
    await assert.rejects(saveProfile(U, OWNER, 1, 2, ADMIN), { code: "42501" });
    await assert.rejects(saveProfile(U, OWNER, 1, 2, "00000000-0000-4000-8000-000000000000"), { code: "42501" });
    await assert.rejects(saveProfile(V, OWNER, 0, 2, U, Q), { code: "42501" }); // U is not in Q.
    for (const status of ["inactive", null]) {
      await db.query("update people set status=$2 where id=$1", [V, status]);
      await assert.rejects(saveProfile(V, OWNER, 0, 2), { code: "42501" });
      await assert.rejects(saveProfile(U, OWNER, 1, 2, V), { code: "42501" });
    }
    await db.query("update people set status='active' where id=$1", [V]);
    await db.query("update period_members set status='guest' where person_id=$1 and period_id=$2", [V, P]);
    await assert.rejects(saveProfile(U, OWNER, 1, 2, V), { code: "42501" });
    await db.query("update period_members set status='fixed' where person_id=$1 and period_id=$2", [V, P]);
    await db.query("update person_groups set member_role='admin' where person_id=$1 and group_id=$2", [V, A]);
    await assert.rejects(saveProfile(U, OWNER, 1, 2, V), { code: "42501" });
    await db.query("update person_groups set member_role='member' where person_id=$1 and group_id=$2", [V, A]);
    await db.query("update auth.users set raw_app_meta_data=$2::jsonb where id=$1", [V, JSON.stringify({ role: "admin" })]);
    await assert.rejects(saveProfile(U, OWNER, 1, 2, V), { code: "42501" });
    await db.query("update auth.users set raw_app_meta_data='{}'::jsonb where id=$1", [V]);
  });

  await t.test("invalid profile values, self pairs, null/closed periods cannot write", async () => {
    for (const level of [0, 4, -1]) await assert.rejects(saveProfile(V, OWNER, 0, level), { code: "22023" });
    await assert.rejects(saveProfile(V, OWNER, -1, 1), { code: "22023" });
    await assert.rejects(saveProfile(V, OWNER, 0, 1, V), { code: "22023" });
    for (const status of ["closed", null]) {
      await db.query("update periods set status=$2 where id=$1", [P, status]);
      await assert.rejects(saveProfile(V, OWNER, 0, 1), { code: "22023" });
    }
    await db.query("update periods set status='open' where id=$1", [P]);
    assert.equal((await db.query("select * from session_planning_profiles where person_id=$1", [V])).rows.length, 0);
  });

  await t.test("profile stale revisions cannot overwrite; unknown level and clearing a pair are explicit", async () => {
    const results = await Promise.allSettled([saveProfile(U, ADMIN, 1, null), saveProfile(U, OWNER, 1, 3, V)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.code, "40001");
    const saved = await saveProfile(U, OWNER, 2, null);
    assert.equal(saved.rows[0].level, null); assert.equal(saved.rows[0].preferred_partner_id, null);
    const audits = (await db.query("select * from session_planning_profile_audits where person_id=$1 order by revision", [U])).rows;
    assert.equal(audits.length, 3); assert.equal(audits[2].before_value.revision, 2);
  });

  await t.test("profile tables are private, RPC is service-role-only and direct updates are denied", async () => {
    for (const role of ["anon", "authenticated"]) await asRole(role, async () => {
      await assert.rejects(db.query("select * from session_planning_profiles"), { code: "42501" });
      await assert.rejects(db.query("select * from session_planning_profile_audits"), { code: "42501" });
      await assert.rejects(saveProfile(V, OWNER, 0, 1), { code: "42501" });
    });
    await asRole("service_role", async () => {
      await assert.rejects(db.query("delete from session_planning_profiles"), { code: "42501" });
      await assert.rejects(db.query("update session_planning_profiles set level=3"), { code: "42501" });
    });
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='session_planning_profiles'")).rows[0].relrowsecurity, true);
  });

  await t.test("audit failure rolls profile write back, and profiles remain independent across clubs", async () => {
    await db.exec(`create function public.profile_test_fail() returns trigger language plpgsql as $$ begin raise exception 'profile audit failure'; end $$;
      create trigger profile_test_fail before insert on public.session_planning_profile_audits for each row execute function public.profile_test_fail();`);
    await assert.rejects(saveProfile(V, OWNER, 0, 3), /profile audit failure/);
    assert.equal((await db.query("select * from session_planning_profiles where person_id=$1", [V])).rows.length, 0);
    await db.exec("drop trigger profile_test_fail on public.session_planning_profile_audits; drop function public.profile_test_fail();");
    await saveProfile(V, ADMIN, 0, 1, U);
    await saveProfile(V, OWNER, 0, 3, null, Q);
    const rows = (await db.query("select period_id, level from session_planning_profiles where person_id=$1 order by period_id", [V])).rows;
    assert.deepEqual(rows.map((row) => row.level), [1, 3]);
    assert.equal((await db.query("select count(*)::int as n from period_members")).rows[0].n, 4);
  });
});
