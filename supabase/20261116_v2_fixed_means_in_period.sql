-- Một trạng thái duy nhất: CÓ TÊN TRONG KỲ ĐANG MỞ = CỐ ĐỊNH, còn lại = VÃNG LAI.
-- Chủ CLB quyết định ngày 16/11/2026.
--
-- Trước đây có hai chỗ ghi riêng: people.attendance_type (hồ sơ) và period_members.status (trong kỳ),
-- và chúng lệch nhau. Dữ liệu thật cho thấy period_members chưa bao giờ dùng trạng thái 'guest':
-- ai trong kỳ đều là 'fixed'.
--
-- File này:
-- 1. Thay hai hàm v2 (của file 20261116_v2_period_members.sql):
--    - Thêm người vào kỳ: luôn là 'fixed', tạo phí cố định như trước.
--    - Đổi người trong kỳ: chỉ 'fixed' (trong kỳ) hoặc 'inactive' (đã rời kỳ). Rời kỳ hủy phí cố định
--      chưa trả; phí đã trả giữ nguyên và báo hoàn tay, như trước.
--    - Cả hai cập nhật luôn people.attendance_type cho khớp, để bản cũ (vẫn đọc ô này) thấy giống hệt.
-- 2. Đồng bộ một lần people.attendance_type theo kỳ đang mở của từng nhóm
--    (dữ liệu ngày 16/11: ĐỖ ĐĂNG THUẦN, Đức Hùng thành vãng lai; Kite Endo thành cố định).
--    Chỉ đổi ô cố định/vãng lai của hồ sơ; không đổi nợ, quỹ, kỳ hay thành viên trong kỳ.
--
-- Cách chạy: dán toàn bộ file vào Supabase SQL Editor rồi bấm Run một lần.
-- Hoàn tác phần hàm: chạy lại 20261116_v2_period_members.sql.

begin;

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
    select p.id, p.status::text as status,
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

    -- Có tên trong kỳ là cố định.
    insert into public.period_members (period_id, person_id, status)
    values (p_period_id, v_person.id, 'fixed');
    update public.people set attendance_type = 'fixed', updated_at = now() where id = v_person.id and attendance_type is distinct from 'fixed';
    v_added := v_added + 1;

    if coalesce(v_period.fixed_member_fee, 0) > 0 and not exists (
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
  -- 'fixed' = trong kỳ, 'inactive' = đã rời kỳ. Không còn 'guest' trong kỳ.
  if p_status is null or p_status not in ('fixed', 'inactive') or p_discount is null or p_discount not in (0, 50, 100) then
    raise exception using errcode = '22023', message = 'V2_INVALID_INPUT';
  end if;

  select * into v_member from public.period_members where id = p_member_id;
  if not found then raise exception using errcode = '22023', message = 'V2_MEMBER_NOT_FOUND'; end if;
  select * into v_period from public.periods where id = v_member.period_id for update;
  select * into v_member from public.period_members where id = p_member_id for update;
  if v_period.status::text = 'closed' then raise exception using errcode = '22023', message = 'V2_PERIOD_CLOSED'; end if;

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

  -- Ô cố định/vãng lai của hồ sơ theo kỳ đang mở, để bản cũ thấy giống hệt.
  if v_period.status::text = 'open' then
    update public.people
    set attendance_type = case when p_status = 'fixed' then 'fixed' else 'guest' end, updated_at = now()
    where id = v_member.person_id
      and attendance_type is distinct from case when p_status = 'fixed' then 'fixed' else 'guest' end;
  end if;

  return jsonb_build_object('action', v_action);
end;
$$;

revoke all on function public.v2_add_period_members(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.v2_update_period_member(uuid, text, smallint) from public, anon, authenticated;
grant execute on function public.v2_add_period_members(uuid, uuid[]) to service_role;
grant execute on function public.v2_update_period_member(uuid, text, smallint) to service_role;

-- Đồng bộ một lần: hồ sơ của người đang hoạt động trong nhóm có kỳ đang mở.
update public.people p
set attendance_type = desired.value, updated_at = now()
from (
  select g.person_id as id,
    case when bool_or(exists (
      select 1 from public.period_members pm
      where pm.period_id = op.id and pm.person_id = g.person_id and pm.status::text = 'fixed'
    )) then 'fixed' else 'guest' end as value
  from public.periods op
  join public.person_groups g on g.group_id = op.group_id and g.status::text = 'active'
  where op.status::text = 'open'
  group by g.person_id
) desired
where p.id = desired.id and p.attendance_type is distinct from desired.value;

commit;
