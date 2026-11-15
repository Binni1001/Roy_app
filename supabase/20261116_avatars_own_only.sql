-- Ảnh đại diện: mỗi người chỉ thêm, ghi đè hoặc xóa ảnh của chính mình.
-- Owner và admin vẫn đổi được ảnh cho người khác (màn hình Nhân sự của bản cũ).
--
-- Trước migration này, mọi tài khoản đã đăng nhập ghi đè hoặc xóa được ảnh của bất kỳ ai
-- (xem 20260624_avatars_storage.sql). Chủ CLB quyết định siết lại ngày 16/11/2026.
--
-- Quy ước tên file (bản cũ và v2 giống nhau): <people.id>.<đuôi>, nằm ở gốc bucket avatars.
-- Ai cũng vẫn XEM được mọi ảnh (policy avatars_public_read giữ nguyên).
-- v2 tải ảnh qua API bằng khóa service nên không bị ảnh hưởng.
--
-- Cách chạy: dán toàn bộ file vào Supabase SQL Editor rồi bấm Run một lần.
-- Hoàn tác: chạy lại 20260624_avatars_storage.sql (trả về quyền rộng như cũ).

begin;

-- true khi người đang đăng nhập được ghi vào file ảnh có tên object_name.
-- security definer để đọc được bảng people dù tài khoản thường không có quyền đọc bảng.
create or replace function public.can_write_avatar(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'admin'), false)
    or exists (
      select 1
      from public.people p
      where p.email is not null
        and lower(p.email) = lower(auth.jwt() ->> 'email')
        -- Chỉ file ở gốc bucket, tên đúng bằng id hồ sơ của mình cộng một đuôi ảnh.
        and object_name ~* ('^' || p.id::text || '\.(jpg|jpeg|png|gif|webp)$')
    );
$$;

revoke all on function public.can_write_avatar(text) from public;
grant execute on function public.can_write_avatar(text) to authenticated;

drop policy if exists "avatars_auth_insert" on storage.objects;
drop policy if exists "avatars_auth_update" on storage.objects;
drop policy if exists "avatars_auth_delete" on storage.objects;

create policy "avatars_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and public.can_write_avatar(name));

create policy "avatars_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and public.can_write_avatar(name))
  with check (bucket_id = 'avatars' and public.can_write_avatar(name));

create policy "avatars_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and public.can_write_avatar(name));

commit;
