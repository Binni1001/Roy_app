// Chạy migration siết quyền ảnh đại diện trên PostgreSQL nhúng (PGlite) với schema Supabase tối thiểu, dữ liệu giả.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sqlFile = (name: string) => readFileSync(new URL(`../../../../../supabase/${name}`, import.meta.url), "utf8");

test("avatars: each member writes only their own file; admins any; reading stays public", async () => {
  const db = new PGlite();

  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth, storage to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text, unique (bucket_id, name));
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    grant usage on sequence storage.objects_id_seq to authenticated;
    create table public.people (id uuid primary key, email text);
    insert into public.people values
      ('11111111-1111-1111-1111-111111111111', 'Minh@Example.com'),
      ('22222222-2222-2222-2222-222222222222', 'lan@example.com');
    insert into storage.objects (bucket_id, name) values
      ('avatars', '22222222-2222-2222-2222-222222222222.png');
  `);
  await db.exec(sqlFile("20260624_avatars_storage.sql"));
  await db.exec(sqlFile("20261116_avatars_own_only.sql"));
  // Chạy lại lần hai: migration phải chạy lại được mà không lỗi.
  await db.exec(sqlFile("20261116_avatars_own_only.sql"));

  async function as(claims: Record<string, unknown>, sql: string): Promise<{ ok: boolean; rows?: number; error?: string }> {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.exec("set role authenticated");
    try {
      const result = await db.query(sql);
      return { ok: true, rows: result.affectedRows ?? 0 };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    } finally {
      await db.exec("reset role");
    }
  }

  const minh = { email: "minh@example.com", app_metadata: { role: "user" } };
  const admin = { email: "boss@example.com", app_metadata: { role: "admin" } };
  const forged = { email: "minh@example.com", user_metadata: { role: "owner" } };
  const MINH = "11111111-1111-1111-1111-111111111111";
  const LAN = "22222222-2222-2222-2222-222222222222";

  // Ghi ảnh của mình: được, kể cả đuôi viết hoa như bản cũ có thể gửi.
  assert.equal((await as(minh, `insert into storage.objects (bucket_id, name) values ('avatars', '${MINH}.JPG')`)).ok, true);
  assert.equal((await as(minh, `update storage.objects set name = '${MINH}.jpg' where name = '${MINH}.JPG'`)).rows, 1);
  // Ghi ảnh người khác: bị chặn.
  assert.equal((await as(minh, `insert into storage.objects (bucket_id, name) values ('avatars', '${LAN}.webp')`)).ok, false);
  assert.equal((await as(minh, `update storage.objects set name = '${LAN}.png' where name = '${LAN}.png'`)).rows, 0);
  assert.equal((await as(minh, `delete from storage.objects where name = '${LAN}.png'`)).rows, 0);
  // Tên lách luật: thư mục con, đuôi lạ, id người khác ghép thêm.
  for (const name of [`x/${MINH}.png`, `${MINH}.png.exe`, `${MINH}.svg`, `${LAN}${MINH}.png`]) {
    assert.equal((await as(minh, `insert into storage.objects (bucket_id, name) values ('avatars', '${name}')`)).ok, false, name);
  }
  // Vai trò tự khai trong user_metadata không có tác dụng.
  assert.equal((await as(forged, `delete from storage.objects where name = '${LAN}.png'`)).rows, 0);
  // Admin vẫn đổi ảnh hộ người khác được.
  assert.equal((await as(admin, `update storage.objects set name = '${LAN}.png' where name = '${LAN}.png'`)).rows, 1);
  // Xóa ảnh của chính mình: được.
  assert.equal((await as(minh, `delete from storage.objects where name = '${MINH}.jpg'`)).rows, 1);
  // Ai cũng vẫn xem được ảnh.
  assert.equal((await as({}, `select 1 from storage.objects where bucket_id = 'avatars'`)).ok, true);

  // console.log("avatar policy: all checks passed");
});
