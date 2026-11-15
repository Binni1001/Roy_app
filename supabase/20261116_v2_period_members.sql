-- v2: thêm người vào kỳ và đổi trạng thái / mức miễn tiền cầu, mỗi việc trọn trong một giao dịch.
--
-- Bản cũ làm việc này bằng nhiều câu lệnh rời từ backend (periodMembers.service.js): thêm người
-- rồi mới tạo nợ phí cố định, đổi trạng thái rồi mới hủy nợ. Lỗi giữa chừng có thể để lại người
-- trong kỳ mà thiếu nợ, hoặc nợ treo. Hai hàm dưới làm đúng nghiệp vụ đó nhưng nguyên khối.
--
-- Chỉ THÊM hai hàm mới. Không đổi bảng, không đổi dữ liệu cũ, không đụng hàm của bản cũ.
-- Các trigger sẵn có vẫn chạy: guard_shuttle_discount (kỳ đã chốt chia cầu thì không đổi),
-- guard_closeout_finance_write và auto_offset_new_debt (tự bù số dư khi có nợ mới).
--
-- Cách chạy: dán toàn bộ file vào Supabase SQL Editor rồi bấm Run một lần.
-- Hoàn tác: drop function public.v2_add_period_members(uuid, uuid[]);
--           drop function public.v2_update_period_member(uuid, text, smallint);

begin;

-- Thêm nhiều người vào một kỳ. Loại (cố định / vãng lai) lấy theo hồ sơ, như bản cũ.
-- Người cố định được tạo nợ phí cố định nếu kỳ có phí và người đó chưa từng có khoản này.
create or replace function public.v2_add_period_members(p_period_id uuid, p_person_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_period public.periods%rowtype;
  v_ids uuid[];
  v_person record;
  v_status text;
  v_added int := 0;
  v_skipped int := 0;
  v_fees int := 0;
begin
  select array_agg(distinct id) into v_ids from unnest(p_person_ids) as id where id is not null;
  if v_ids is null or cardinality(v_ids) = 0 or cardinality(v_ids) > 100 then
    raise exception using errcode = '22023', message = 'V2_MEMBER_COUNT';
  end if;

  select * into v_period from public.periods where id = p_period_id for update;
  if not found then raise exception using errcode = '22023', message = 'V2_PERIOD_NOT_FOUND'; end if;
  if v_period.status::text = 'closed' then raise exception using errcode = '22023', message = 'V2_PERIOD_CLOSED'; end if;
  if exists (select 1 from public.shuttle_settlement_runs where period_id = p_period_id) then
    raise exception using errcode = '22023', message = 'V2_PERIOD_SETTLED';
  end if;

  if (select count(*) from public.people where id = any(v_ids)) <> cardinality(v_ids) then
    raise exception using errcode = '22023', message = 'V2_PERSON_NOT_FOUND';
  end if;

  for v_person in
    select p.id, p.attendance_type, p.status::text as status,
      exists (
        select 1 from public.person_groups g
        where g.person_id = p.id and g.group_id = v_period.group_id and g.status::text = 'active'
      ) as in_group,
      exists (select 1 from public.period_members m where m.period_id = p_period_id and m.person_id = p.id) as already
    from public.people p
    where p.id = any(v_ids)
    order by p.id
  loop
    if v_person.already then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_person.status <> 'active' or not v_person.in_group then
      raise exception using errcode = '22023', message = 'V2_PERSON_NOT_IN_GROUP';
    end if;

    v_status := case when v_person.attendance_type = 'fixed' then 'fixed' else 'guest' end;
    insert into public.period_members (period_id, person_id, status)
    values (p_period_id, v_person.id, v_status::public.period_member_status);
    v_added := v_added + 1;

    if v_status = 'fixed' and coalesce(v_period.fixed_member_fee, 0) > 0 and not exists (
      select 1 from public.debts
      where period_id = p_period_id and person_id = v_person.id and debt_type = 'monthly_fee'
    ) then
      insert into public.debts (period_id, person_id, debt_type, amount, status, description)
      values (p_period_id, v_person.id, 'monthly_fee', v_period.fixed_member_fee, 'unpaid', 'Tien co dinh ' || v_period.name);
      v_fees := v_fees + 1;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'skipped', v_skipped, 'fees_created', v_fees);
end;
$$;

-- Đổi trạng thái trong kỳ (fixed / guest / inactive) và mức miễn tiền cầu (0, 50, 100%).
-- Sang cố định: tạo nợ phí cố định nếu chưa có. Rời cố định: hủy nợ phí chưa trả;
-- phí đã trả thì giữ nguyên và báo để quản trị hoàn tiền bằng tay, như bản cũ.
create or replace function public.v2_update_period_member(p_member_id uuid, p_status text, p_discount smallint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member public.period_members%rowtype;
  v_period public.periods%rowtype;
  v_debt public.debts%rowtype;
  v_action text := 'none';
begin
  if p_status is null or p_status not in ('fixed', 'guest', 'inactive') or p_discount is null or p_discount not in (0, 50, 100) then
    raise exception using errcode = '22023', message = 'V2_INVALID_INPUT';
  end if;

  select * into v_member from public.period_members where id = p_member_id;
  if not found then raise exception using errcode = '22023', message = 'V2_MEMBER_NOT_FOUND'; end if;
  select * into v_period from public.periods where id = v_member.period_id for update;
  select * into v_member from public.period_members where id = p_member_id for update;
  if v_period.status::text = 'closed' then raise exception using errcode = '22023', message = 'V2_PERIOD_CLOSED'; end if;

  -- Trigger guard_shuttle_discount từ chối nếu kỳ đã chốt chia cầu mà trạng thái hoặc mức miễn đổi.
  update public.period_members
  set status = p_status::public.period_member_status,
      shuttle_discount_percent = p_discount,
      updated_at = now()
  where id = p_member_id;

  if v_member.status::text <> p_status then
    select * into v_debt from public.debts
    where period_id = v_member.period_id and person_id = v_member.person_id
      and debt_type = 'monthly_fee' and status::text <> 'cancelled'
    order by created_at
    limit 1;

    if p_status = 'fixed' then
      if not found and coalesce(v_period.fixed_member_fee, 0) > 0 then
        insert into public.debts (period_id, person_id, debt_type, amount, status, description)
        values (v_member.period_id, v_member.person_id, 'monthly_fee', v_period.fixed_member_fee, 'unpaid',
                'Tien co dinh ' || v_period.name);
        v_action := 'fee_created';
      end if;
    elsif v_member.status::text = 'fixed' and found then
      if v_debt.status::text = 'unpaid' then
        update public.debts set status = 'cancelled', updated_at = now() where id = v_debt.id;
        v_action := 'fee_cancelled';
      elsif v_debt.status::text = 'paid' then
        v_action := 'fee_paid_refund_needed';
      end if;
    end if;
  end if;

  return jsonb_build_object('action', v_action);
end;
$$;

-- Chỉ backend (khóa service) được gọi; trình duyệt không gọi thẳng được.
revoke all on function public.v2_add_period_members(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.v2_update_period_member(uuid, text, smallint) from public, anon, authenticated;
grant execute on function public.v2_add_period_members(uuid, uuid[]) to service_role;
grant execute on function public.v2_update_period_member(uuid, text, smallint) to service_role;

commit;
