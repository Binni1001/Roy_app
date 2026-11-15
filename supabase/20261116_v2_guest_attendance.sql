-- v2: ghi khách vãng lai của một buổi và phí khách, mỗi thao tác trọn trong một giao dịch.
--
-- Bản cũ (guestAttendances.service.js) ghi người vào buổi rồi mới tạo nợ phí khách bằng câu lệnh rời,
-- và khi xóa khách thì hủy cả khoản phí ĐÃ TRẢ. Các hàm dưới làm cùng nghiệp vụ nhưng nguyên khối,
-- và từ chối đổi hoặc xóa khi khách đã trả tiền (phải hoàn tiền ở sổ quỹ trước).
--
-- Chỉ THÊM ba hàm mới. Không đổi bảng, không đổi dữ liệu cũ. Trigger sẵn có vẫn chạy
-- (guard_closeout_finance_write, auto_offset_new_debt).
--
-- Cách chạy: dán toàn bộ file vào Supabase SQL Editor rồi bấm Run một lần.
-- Hoàn tác: drop function public.v2_add_guest_attendance(uuid, uuid, numeric, text);
--           drop function public.v2_update_guest_attendance(uuid, numeric, text);
--           drop function public.v2_remove_guest_attendance(uuid);

begin;

-- Kỳ của buổi phải đang mở và chưa chốt chia tiền cầu, vì sau đó không tạo hay hủy nợ được nữa.
create or replace function public.v2_guest_period_for_session(p_session_id uuid)
returns public.periods
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_period public.periods%rowtype;
begin
  select p.* into v_period
  from public.badminton_sessions s join public.periods p on p.id = s.period_id
  where s.id = p_session_id
  for update of p;
  if not found then raise exception using errcode = '22023', message = 'V2_SESSION_NOT_FOUND'; end if;
  if v_period.status::text <> 'open' then raise exception using errcode = '22023', message = 'V2_PERIOD_NOT_OPEN'; end if;
  if exists (select 1 from public.shuttle_settlement_runs where period_id = v_period.id) then
    raise exception using errcode = '22023', message = 'V2_PERIOD_SETTLED';
  end if;
  return v_period;
end;
$$;

create or replace function public.v2_check_guest_amount(p_amount numeric)
returns void
language plpgsql
immutable
as $$
begin
  if p_amount is null or p_amount < 0 or p_amount > 10000000 or p_amount <> trunc(p_amount) then
    raise exception using errcode = '22023', message = 'V2_INVALID_AMOUNT';
  end if;
end;
$$;

create or replace function public.v2_add_guest_attendance(p_session_id uuid, p_person_id uuid, p_amount numeric, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_period public.periods%rowtype;
  v_date date;
  v_attendance uuid;
begin
  perform public.v2_check_guest_amount(p_amount);
  if p_note is not null and length(p_note) > 500 then raise exception using errcode = '22023', message = 'V2_NOTE_TOO_LONG'; end if;
  v_period := public.v2_guest_period_for_session(p_session_id);
  select play_date into v_date from public.badminton_sessions where id = p_session_id;

  if not exists (
    select 1 from public.people p join public.person_groups g on g.person_id = p.id
    where p.id = p_person_id and p.status::text = 'active'
      and g.group_id = v_period.group_id and g.status::text = 'active'
  ) then
    raise exception using errcode = '22023', message = 'V2_PERSON_NOT_IN_GROUP';
  end if;
  if exists (select 1 from public.guest_attendances where session_id = p_session_id and person_id = p_person_id) then
    raise exception using errcode = '22023', message = 'V2_ALREADY_IN_SESSION';
  end if;

  insert into public.guest_attendances (session_id, person_id, amount, note)
  values (p_session_id, p_person_id, p_amount, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_attendance;

  if p_amount > 0 then
    insert into public.debts (period_id, person_id, debt_type, amount, status, source_attendance_id, description)
    values (v_period.id, p_person_id, 'guest_fee', p_amount, 'unpaid', v_attendance,
            'Tien khach vang lai ' || v_period.name || ' ngay ' || v_date || ' [guest_attendance:' || v_attendance || ']');
  end if;

  return jsonb_build_object('attendance_id', v_attendance, 'fee_created', p_amount > 0);
end;
$$;

create or replace function public.v2_update_guest_attendance(p_attendance_id uuid, p_amount numeric, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attendance public.guest_attendances%rowtype;
  v_period public.periods%rowtype;
  v_date date;
  v_debt public.debts%rowtype;
begin
  perform public.v2_check_guest_amount(p_amount);
  if p_note is not null and length(p_note) > 500 then raise exception using errcode = '22023', message = 'V2_NOTE_TOO_LONG'; end if;
  select * into v_attendance from public.guest_attendances where id = p_attendance_id;
  if not found then raise exception using errcode = '22023', message = 'V2_ATTENDANCE_NOT_FOUND'; end if;
  v_period := public.v2_guest_period_for_session(v_attendance.session_id);
  select * into v_attendance from public.guest_attendances where id = p_attendance_id for update;
  select play_date into v_date from public.badminton_sessions where id = v_attendance.session_id;

  if p_amount <> v_attendance.amount then
    select * into v_debt from public.debts
    where source_attendance_id = p_attendance_id and debt_type = 'guest_fee' and status::text <> 'cancelled'
    order by created_at limit 1;
    if found and v_debt.status::text = 'paid' then
      raise exception using errcode = '22023', message = 'V2_GUEST_FEE_PAID';
    end if;
    if found then
      update public.debts set status = 'cancelled', updated_at = now() where id = v_debt.id;
    end if;
    if p_amount > 0 then
      insert into public.debts (period_id, person_id, debt_type, amount, status, source_attendance_id, description)
      values (v_period.id, v_attendance.person_id, 'guest_fee', p_amount, 'unpaid', p_attendance_id,
              'Tien khach vang lai ' || v_period.name || ' ngay ' || v_date || ' [guest_attendance:' || p_attendance_id || ']');
    end if;
  end if;

  update public.guest_attendances
  set amount = p_amount, note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
  where id = p_attendance_id;

  return jsonb_build_object('fee_changed', p_amount <> v_attendance.amount);
end;
$$;

create or replace function public.v2_remove_guest_attendance(p_attendance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attendance public.guest_attendances%rowtype;
  v_debt public.debts%rowtype;
  v_cancelled boolean := false;
begin
  select * into v_attendance from public.guest_attendances where id = p_attendance_id;
  if not found then raise exception using errcode = '22023', message = 'V2_ATTENDANCE_NOT_FOUND'; end if;
  perform public.v2_guest_period_for_session(v_attendance.session_id);
  select * into v_attendance from public.guest_attendances where id = p_attendance_id for update;

  select * into v_debt from public.debts
  where source_attendance_id = p_attendance_id and debt_type = 'guest_fee' and status::text <> 'cancelled'
  order by created_at limit 1;
  if found and v_debt.status::text = 'paid' then
    raise exception using errcode = '22023', message = 'V2_GUEST_FEE_PAID';
  end if;
  if found then
    update public.debts set status = 'cancelled', updated_at = now() where id = v_debt.id;
    v_cancelled := true;
  end if;

  delete from public.guest_attendances where id = p_attendance_id;
  return jsonb_build_object('fee_cancelled', v_cancelled);
end;
$$;

-- Chỉ backend (khóa service) được gọi; trình duyệt không gọi thẳng được.
revoke all on function public.v2_guest_period_for_session(uuid) from public, anon, authenticated;
revoke all on function public.v2_check_guest_amount(numeric) from public, anon, authenticated;
revoke all on function public.v2_add_guest_attendance(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.v2_update_guest_attendance(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.v2_remove_guest_attendance(uuid) from public, anon, authenticated;
grant execute on function public.v2_add_guest_attendance(uuid, uuid, numeric, text) to service_role;
grant execute on function public.v2_update_guest_attendance(uuid, numeric, text) to service_role;
grant execute on function public.v2_remove_guest_attendance(uuid) to service_role;

commit;
