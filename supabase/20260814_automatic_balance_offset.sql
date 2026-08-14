-- Persist positive shuttle credits and automatically apply them to unpaid debts.
-- Positive credit is global per person because person_balances is global per person.

create table if not exists public.shuttle_settlement_runs (
  period_id uuid primary key references public.periods(id) on delete cascade,
  settled_at timestamptz not null default now(),
  total_shuttle_amount numeric not null default 0,
  share_per_member numeric not null default 0,
  result jsonb not null default '{}'::jsonb
);

alter table public.shuttle_settlement_runs enable row level security;

create unique index if not exists balance_transactions_shuttle_credit_unique
on public.balance_transactions (period_id, person_id, transaction_type)
where transaction_type = 'credit_from_shuttle_purchase'
  and direction = 'plus';

create or replace function public.offset_person_unpaid_debts(p_person_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.person_balances%rowtype;
  v_debt public.debts%rowtype;
  v_old_amount numeric;
  v_offset numeric;
  v_remaining numeric;
  v_total_offset numeric := 0;
  v_updated_debts jsonb := '[]'::jsonb;
begin
  select *
  into v_balance
  from public.person_balances
  where person_id = p_person_id
  for update;

  if not found or v_balance.balance <= 0 then
    return jsonb_build_object(
      'offset_amount', 0,
      'remaining_balance', coalesce(v_balance.balance, 0),
      'updated_debts', '[]'::jsonb
    );
  end if;

  for v_debt in
    select *
    from public.debts
    where person_id = p_person_id
      and status = 'unpaid'
      and amount > 0
    order by created_at asc, id asc
    for update
  loop
    exit when v_balance.balance <= 0;

    v_old_amount := v_debt.amount;
    v_offset := least(v_balance.balance, v_debt.amount);
    v_remaining := v_debt.amount - v_offset;

    if v_remaining = 0 then
      update public.debts
      set status = 'paid',
          paid_at = coalesce(paid_at, now()),
          updated_at = now(),
          description = concat_ws(' | ', nullif(description, ''), 'Da tu dong bu tru bang so du')
      where id = v_debt.id
      returning * into v_debt;
    else
      update public.debts
      set amount = v_remaining,
          updated_at = now(),
          description = concat_ws(' | ', nullif(description, ''), 'Da tu dong bu tru ' || v_offset::text)
      where id = v_debt.id
      returning * into v_debt;
    end if;

    update public.person_balances
    set balance = balance - v_offset,
        updated_at = now()
    where person_id = p_person_id
    returning * into v_balance;

    insert into public.balance_transactions (
      person_id,
      period_id,
      related_debt_id,
      transaction_type,
      amount,
      direction,
      description
    ) values (
      p_person_id,
      v_debt.period_id,
      v_debt.id,
      'offset_next_period',
      v_offset,
      'minus',
      'Tu dong bu tru so du vao cong no'
    );

    v_total_offset := v_total_offset + v_offset;
    v_updated_debts := v_updated_debts || jsonb_build_array(jsonb_build_object(
      'debt_id', v_debt.id,
      'old_amount', v_old_amount,
      'offset_amount', v_offset,
      'remaining_amount', v_remaining,
      'debt', to_jsonb(v_debt)
    ));
  end loop;

  return jsonb_build_object(
    'offset_amount', v_total_offset,
    'remaining_balance', v_balance.balance,
    'updated_debts', v_updated_debts
  );
end;
$$;

revoke all on function public.offset_person_unpaid_debts(uuid) from public;
grant execute on function public.offset_person_unpaid_debts(uuid) to service_role;

create or replace function public.auto_offset_new_debt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'unpaid' and new.amount > 0 then
    perform public.offset_person_unpaid_debts(new.person_id);
  end if;
  return new;
end;
$$;

drop trigger if exists debts_auto_offset_after_insert on public.debts;
create trigger debts_auto_offset_after_insert
after insert on public.debts
for each row execute function public.auto_offset_new_debt();

-- Keep the old RPC compatible, but apply the credit to all unpaid debts.
create or replace function public.offset_person_period(
  p_person_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.offset_person_unpaid_debts(p_person_id);
end;
$$;

grant execute on function public.offset_person_period(uuid, uuid) to service_role;

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

  select count(*) into v_member_count
  from public.period_members
  where period_id = p_period_id
    and status = 'fixed'
    and coalesce(exempt_shuttle, false) = false;

  if v_member_count = 0 then
    raise exception 'Ky nay chua co thanh vien co dinh phai dong tien cau';
  end if;

  select coalesce(sum(total_amount), 0), coalesce(sum(total_shuttle_count), 0)
  into v_total_amount, v_total_shuttles
  from public.shuttle_expenses
  where period_id = p_period_id;

  v_share := round(v_total_amount / v_member_count);

  insert into public.shuttle_settlement_runs (
    period_id,
    total_shuttle_amount,
    share_per_member
  ) values (
    p_period_id,
    v_total_amount,
    v_share
  );

  for v_item in
    select
      pm.person_id,
      to_jsonb(pe) as person,
      coalesce(sum(se.total_amount), 0) as paid_for_shuttles,
      coalesce(sum(se.total_amount), 0) - v_share as net_amount
    from public.period_members pm
    join public.people pe on pe.id = pm.person_id
    left join public.shuttle_expenses se
      on se.period_id = pm.period_id
     and se.buyer_id = pm.person_id
    where pm.period_id = p_period_id
      and pm.status = 'fixed'
      and coalesce(pm.exempt_shuttle, false) = false
    group by pm.person_id, pe.id
  loop
    v_preview_details := v_preview_details || jsonb_build_array(jsonb_build_object(
      'person_id', v_item.person_id,
      'person', v_item.person,
      'paid_for_shuttles', v_item.paid_for_shuttles,
      'shuttle_share', v_share,
      'net_amount', v_item.net_amount,
      'result', case
        when v_item.net_amount > 0 then 'positive_balance'
        when v_item.net_amount < 0 then 'need_to_pay'
        else 'settled'
      end
    ));

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

-- Mark legacy periods that were already settled. This prevents a second settlement.
insert into public.shuttle_settlement_runs (
  period_id,
  settled_at,
  total_shuttle_amount,
  share_per_member,
  result
)
select
  p.id,
  coalesce((
    select min(d.created_at) from public.debts d
    where d.period_id = p.id and d.debt_type = 'shuttle_extra'
  ), now()),
  coalesce((select sum(se.total_amount) from public.shuttle_expenses se where se.period_id = p.id), 0),
  case when (
    select count(*) from public.period_members pm
    where pm.period_id = p.id
      and pm.status = 'fixed'
      and coalesce(pm.exempt_shuttle, false) = false
  ) > 0 then round(
    coalesce((select sum(se.total_amount) from public.shuttle_expenses se where se.period_id = p.id), 0)
    / (
      select count(*) from public.period_members pm
      where pm.period_id = p.id
        and pm.status = 'fixed'
        and coalesce(pm.exempt_shuttle, false) = false
    )
  ) else 0 end,
  jsonb_build_object('legacy_backfill', true)
from public.periods p
where exists (
  select 1 from public.debts d
  where d.period_id = p.id and d.debt_type = 'shuttle_extra'
)
or exists (
  select 1 from public.balance_transactions bt
  where bt.period_id = p.id
    and bt.transaction_type in ('credit_from_shuttle_purchase', 'debit_shuttle_share')
)
on conflict (period_id) do nothing;

-- Restore only missing positive credits for periods that were already settled.
do $$
declare
  v_item record;
begin
  for v_item in
    with member_counts as (
      select pm.period_id, count(*)::numeric as member_count
      from public.period_members pm
      where pm.status = 'fixed'
        and coalesce(pm.exempt_shuttle, false) = false
      group by pm.period_id
    ), period_totals as (
      select se.period_id, coalesce(sum(se.total_amount), 0)::numeric as total_amount
      from public.shuttle_expenses se
      group by se.period_id
    ), paid_by_person as (
      select se.period_id, se.buyer_id as person_id, coalesce(sum(se.total_amount), 0)::numeric as paid
      from public.shuttle_expenses se
      group by se.period_id, se.buyer_id
    )
    select
      pm.period_id,
      pm.person_id,
      coalesce(pbp.paid, 0) - round(pt.total_amount / mc.member_count) as credit_amount
    from public.period_members pm
    join public.shuttle_settlement_runs ssr on ssr.period_id = pm.period_id
    join member_counts mc on mc.period_id = pm.period_id
    join period_totals pt on pt.period_id = pm.period_id
    left join paid_by_person pbp
      on pbp.period_id = pm.period_id
     and pbp.person_id = pm.person_id
    where pm.status = 'fixed'
      and coalesce(pm.exempt_shuttle, false) = false
      and coalesce(pbp.paid, 0) - round(pt.total_amount / mc.member_count) > 0
      and not exists (
        select 1 from public.balance_transactions bt
        where bt.period_id = pm.period_id
          and bt.person_id = pm.person_id
          and bt.transaction_type = 'credit_from_shuttle_purchase'
          and bt.direction = 'plus'
      )
  loop
    insert into public.person_balances (person_id, balance)
    values (v_item.person_id, v_item.credit_amount)
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
      v_item.period_id,
      'credit_from_shuttle_purchase',
      v_item.credit_amount,
      'plus',
      'Khoi phuc so du duong tu ky da chot'
    );

    perform public.offset_person_unpaid_debts(v_item.person_id);
  end loop;

  for v_item in
    select person_id from public.person_balances where balance > 0
  loop
    perform public.offset_person_unpaid_debts(v_item.person_id);
  end loop;
end;
$$;
