-- Apply manually in Supabase SQL Editor before deploying the application.
-- Requires 20260814_automatic_balance_offset.sql. No historical settlement is recalculated.
begin;

alter table public.period_members
  add column shuttle_discount_percent smallint not null default 0
  check (shuttle_discount_percent in (0, 50, 100));

update public.period_members
set shuttle_discount_percent = case when exempt_shuttle then 100 else 0 end;

-- Serialize member changes with settlement and retain compatibility with legacy clients.
create or replace function public.guard_shuttle_discount()
returns trigger language plpgsql set search_path = public as $$
declare v_period_id uuid;
begin
  if TG_OP = 'DELETE' then v_period_id := OLD.period_id;
  else v_period_id := NEW.period_id; end if;
  perform id from public.periods where id = v_period_id for update;
  if TG_OP = 'UPDATE' and OLD.period_id <> NEW.period_id then
    raise exception 'Khong duoc chuyen thanh vien sang ky khac';
  end if;
  if TG_OP <> 'DELETE' then
    if TG_OP = 'INSERT' then
      if NEW.exempt_shuttle and NEW.shuttle_discount_percent = 0 then
        NEW.shuttle_discount_percent := 100;
      end if;
    elsif NEW.shuttle_discount_percent = OLD.shuttle_discount_percent
      and NEW.exempt_shuttle is distinct from OLD.exempt_shuttle then
      NEW.shuttle_discount_percent := case when NEW.exempt_shuttle then 100 else 0 end;
    end if;
    NEW.exempt_shuttle := NEW.shuttle_discount_percent = 100;
  end if;
  if exists(select 1 from public.shuttle_settlement_runs where period_id = v_period_id) then
    if TG_OP <> 'UPDATE' then
      raise exception 'Ky da chot chia cau, khong the them/xoa thanh vien';
    elsif NEW.shuttle_discount_percent <> OLD.shuttle_discount_percent
      or NEW.status <> OLD.status then
      raise exception 'Ky da chot chia cau, khong the doi muc mien hoac trang thai';
    end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create trigger period_members_shuttle_discount_guard
before insert or update or delete on public.period_members
for each row execute function public.guard_shuttle_discount();

create or replace function public.preview_shuttle_period(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count integer; v_full integer; v_total numeric; v_shuttles integer;
  v_base numeric; v_details jsonb; v_saved jsonb; v_status text;
begin
  select status into v_status from public.periods where id = p_period_id;
  if not found then raise exception 'Ky khong ton tai'; end if;
  select result into v_saved from public.shuttle_settlement_runs where period_id = p_period_id;
  if found then
    return v_saved || jsonb_build_object('settled', true, 'period_id', p_period_id,
      'details', coalesce(v_saved->'preview_details', '[]'::jsonb),
      'fixed_member_count', v_saved->'member_count',
      'total_shuttle_count', v_saved->'total_shuttles');
  end if;
  if v_status = 'draft' then raise exception 'Ky nay chua mo'; end if;
  select count(*), count(*) filter(where shuttle_discount_percent = 0)
    into v_count, v_full from public.period_members
    where period_id = p_period_id and status = 'fixed';
  if v_count = 0 then raise exception 'Ky chua co thanh vien co dinh'; end if;
  select coalesce(sum(total_amount), 0), coalesce(sum(total_shuttle_count), 0)
    into v_total, v_shuttles from public.shuttle_expenses where period_id = p_period_id;
  if v_total <> trunc(v_total) or v_total < 0 then
    raise exception 'Tien cau phai la so nguyen VND khong am';
  end if;
  if v_total > 0 and v_full = 0 then
    raise exception 'Can it nhat mot thanh vien khong mien de chia phan tien duoc giam';
  end if;
  v_base := v_total / v_count;
  with members as (
    select pm.person_id, pm.shuttle_discount_percent, to_jsonb(pe) as person
    from public.period_members pm join public.people pe on pe.id = pm.person_id
    where pm.period_id = p_period_id and pm.status = 'fixed'
  ), discounted as (
    select *, case when shuttle_discount_percent > 0
      then round(v_base * (100 - shuttle_discount_percent) / 100) else 0 end as discount_share
    from members
  ), allocations as (
    select *, case when shuttle_discount_percent = 0 then
      floor((v_total - sum(discount_share) over()) / nullif(v_full, 0))
      + case when row_number() over(order by shuttle_discount_percent, person_id)
          <= mod(v_total - sum(discount_share) over(), nullif(v_full, 0)) then 1 else 0 end
      else discount_share end as shuttle_share
    from discounted
  ), participants as (
    select person_id, person, shuttle_discount_percent, shuttle_share from allocations
    union all
    -- An exempt, guest or former member who advanced money must still receive all credit.
    select pe.id, to_jsonb(pe), 100, 0 from public.people pe
    where exists(select 1 from public.shuttle_expenses se
      where se.period_id = p_period_id and se.buyer_id = pe.id and se.total_amount > 0)
    and not exists(select 1 from members m where m.person_id = pe.id)
  ), totals as (
    select p.*, coalesce((select sum(se.total_amount) from public.shuttle_expenses se
      where se.period_id = p_period_id and se.buyer_id = p.person_id), 0) as paid_for_shuttles
    from participants p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'person_id', person_id, 'person', person, 'shuttle_discount_percent', shuttle_discount_percent,
    'paid_for_shuttles', paid_for_shuttles, 'shuttle_share', shuttle_share,
    'net_amount', paid_for_shuttles - shuttle_share,
    'result', case when paid_for_shuttles > shuttle_share then 'positive_balance'
      when paid_for_shuttles < shuttle_share then 'need_to_pay' else 'settled' end
  ) order by person_id), '[]'::jsonb) into v_details from totals;
  return jsonb_build_object('period_id', p_period_id, 'settled', false,
    'fixed_member_count', v_count, 'total_shuttle_amount', v_total,
    'total_shuttle_count', v_shuttles, 'share_per_member', v_base, 'details', v_details);
end;
$$;

revoke all on function public.preview_shuttle_period(uuid) from public, anon, authenticated;
grant execute on function public.preview_shuttle_period(uuid) to service_role;

create or replace function public.settle_shuttle_period(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.periods%rowtype;
  v_member_count integer;
  v_total_amount numeric;
  v_total_shuttles integer;
  v_share numeric;
  v_item record;
  v_debt public.debts%rowtype;
  v_offset jsonb;
  v_results jsonb := '[]'::jsonb;
  v_preview_details jsonb := '[]'::jsonb;
  v_response jsonb;
  v_preview jsonb;
begin
  select * into v_period
  from public.periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'Ky khong ton tai';
  end if;

  if v_period.status = 'draft' then
    raise exception 'Ky nay chua mo';
  end if;

  if exists (select 1 from public.shuttle_settlement_runs where period_id = p_period_id) then
    raise exception 'Ky nay da chot tien cau roi';
  end if;

  v_preview := public.preview_shuttle_period(p_period_id);
  v_member_count := (v_preview->>'fixed_member_count')::integer;
  v_total_amount := (v_preview->>'total_shuttle_amount')::numeric;
  v_total_shuttles := (v_preview->>'total_shuttle_count')::integer;
  v_share := (v_preview->>'share_per_member')::numeric;

  insert into public.shuttle_settlement_runs (
    period_id,
    total_shuttle_amount,
    share_per_member
  ) values (
    p_period_id,
    v_total_amount,
    v_share
  );

  v_preview_details := v_preview->'details';
  for v_item in
    select * from jsonb_to_recordset(v_preview_details)
      as x(person_id uuid, net_amount numeric)
  loop
    if v_item.net_amount > 0 then
      insert into public.person_balances (person_id, balance)
      values (v_item.person_id, v_item.net_amount)
      on conflict (person_id) do update
      set balance = public.person_balances.balance + excluded.balance,
          updated_at = now();

      insert into public.balance_transactions (
        person_id,
        period_id,
        transaction_type,
        amount,
        direction,
        description
      ) values (
        v_item.person_id,
        p_period_id,
        'credit_from_shuttle_purchase',
        v_item.net_amount,
        'plus',
        'Duong tien do mua cau nhieu hon phan phai chiu'
      );

      v_offset := public.offset_person_unpaid_debts(v_item.person_id);
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', 'credited_balance',
        'amount', v_item.net_amount,
        'offset', v_offset
      ));
    elsif v_item.net_amount < 0 then
      insert into public.debts (
        period_id,
        person_id,
        debt_type,
        amount,
        status,
        description
      ) values (
        p_period_id,
        v_item.person_id,
        'shuttle_extra',
        abs(v_item.net_amount),
        'unpaid',
        'Tien cau phai dong them cuoi ky'
      ) returning * into v_debt;

      select * into v_debt from public.debts where id = v_debt.id;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', case
          when v_debt.status = 'paid' then 'paid_by_balance'
          when v_debt.amount < abs(v_item.net_amount) then 'partially_paid_by_balance'
          else 'created_debt'
        end,
        'original_amount', abs(v_item.net_amount),
        'remaining_amount', case when v_debt.status = 'paid' then 0 else v_debt.amount end,
        'debt', to_jsonb(v_debt)
      ));
    else
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', 'no_action',
        'amount', 0
      ));
    end if;
  end loop;

  v_response := jsonb_build_object(
    'success', true,
    'member_count', v_member_count,
    'total_shuttle_amount', v_total_amount,
    'total_shuttles', v_total_shuttles,
    'share_per_member', v_share,
    'preview_details', v_preview_details,
    'results', v_results
  );

  update public.shuttle_settlement_runs
  set result = v_response
  where period_id = p_period_id;

  return v_response;
end;
$$;

grant execute on function public.settle_shuttle_period(uuid) to service_role;


commit;

