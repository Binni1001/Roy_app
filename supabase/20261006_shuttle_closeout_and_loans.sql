-- Run manually after 20260913_shuttle_discount_percent.sql.
-- Existing settlement snapshots and financial history are preserved.
begin;

create table public.shuttle_loans (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id),
  person_id uuid not null references public.people(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric not null check (unit_price > 0 and unit_price = trunc(unit_price)),
  amount numeric generated always as (quantity * unit_price) stored,
  borrowed_at date not null,
  note text,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'cancelled')),
  paid_at timestamptz,
  fund_transaction_id uuid unique references public.club_fund_transactions(id),
  created_at timestamptz not null default now(),
  check ((status = 'paid') = (fund_transaction_id is not null and paid_at is not null))
);
create index shuttle_loans_period_idx on public.shuttle_loans(period_id, status);
create index shuttle_loans_person_idx on public.shuttle_loans(person_id, status);

create table public.shuttle_fund_allocations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id),
  buyer_id uuid not null references public.people(id),
  expense_id uuid not null references public.shuttle_expenses(id),
  amount numeric not null check (amount > 0 and amount = trunc(amount)),
  fund_transaction_id uuid not null references public.club_fund_transactions(id),
  created_at timestamptz not null default now()
);
alter table public.shuttle_loans enable row level security;
alter table public.shuttle_fund_allocations enable row level security;
revoke all on public.shuttle_loans, public.shuttle_fund_allocations from anon, authenticated;
grant all on public.shuttle_loans, public.shuttle_fund_allocations to service_role;

create or replace function public.shuttle_fund_balance(p_period_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when transaction_type::text in ('income', 'adjustment')
    then amount else -amount end), 0)
  from public.club_fund_transactions where period_id = p_period_id;
$$;

-- All new closeout writes serialize within the group, including older debts.
create or replace function public.lock_shuttle_finance(p_period_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from public.periods where id = p_period_id;
  if not found then raise exception 'Ky khong ton tai'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shuttle-finance:' || coalesce(v_group::text, 'legacy'), 0));
end;
$$;

create or replace function public.shuttle_unpaid_before_closeout(p_period_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.person_name), '[]'::jsonb)
  from (
    select d.id, d.person_id, pe.full_name as person_name, d.amount, p.name as period_name,
      'debt'::text as kind
    from public.debts d join public.periods p on p.id = d.period_id
    join public.people pe on pe.id = d.person_id
    where d.status = 'unpaid' and d.amount > 0
      and p.group_id is not distinct from (select group_id from public.periods where id = p_period_id)
      and p.start_date <= (select start_date from public.periods where id = p_period_id)
    union all
    select l.id, l.person_id, pe.full_name, l.amount, p.name, 'shuttle_loan'
    from public.shuttle_loans l join public.periods p on p.id = l.period_id
    join public.people pe on pe.id = l.person_id
    where l.status = 'unpaid'
      and p.group_id is not distinct from (select group_id from public.periods where id = p_period_id)
      and p.start_date <= (select start_date from public.periods where id = p_period_id)
  ) x;
$$;

-- Weighted shares: 0% = 1 share, 50% = half a share, 100% = zero.
-- Largest remainder allocation conserves the total down to the last VND.
create or replace function public.preview_shuttle_period(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count integer; v_weight numeric; v_total numeric; v_shuttles integer;
  v_details jsonb; v_saved jsonb; v_status text; v_unpaid jsonb; v_fund numeric;
begin
  select status::text into v_status from public.periods where id = p_period_id;
  if not found then raise exception 'Ky khong ton tai'; end if;
  select result into v_saved from public.shuttle_settlement_runs where period_id = p_period_id;
  if found then
    return v_saved || jsonb_build_object('settled', true, 'period_id', p_period_id,
      'details', coalesce(v_saved->'preview_details', '[]'::jsonb),
      'fixed_member_count', v_saved->'member_count', 'total_shuttle_count', v_saved->'total_shuttles');
  end if;
  if v_status <> 'open' then raise exception 'Ky phai dang mo de chia cau'; end if;
  select count(*), coalesce(sum((100 - shuttle_discount_percent)::numeric / 100), 0)
    into v_count, v_weight from public.period_members where period_id = p_period_id and status = 'fixed';
  if v_count = 0 then raise exception 'Ky chua co thanh vien co dinh'; end if;
  select coalesce(sum(total_amount), 0), coalesce(sum(total_shuttle_count), 0)
    into v_total, v_shuttles from public.shuttle_expenses where period_id = p_period_id;
  if v_total <> trunc(v_total) or v_total < 0 then raise exception 'Tien cau phai la so nguyen VND khong am'; end if;
  if v_total > 0 and v_weight = 0 then raise exception 'Can it nhat mot thanh vien chiu tien cau'; end if;
  with members as (
    select pm.person_id, pm.shuttle_discount_percent, to_jsonb(pe) as person,
      coalesce(v_total * (100 - pm.shuttle_discount_percent) / 100 / nullif(v_weight, 0), 0) as exact_share
    from public.period_members pm join public.people pe on pe.id = pm.person_id
    where pm.period_id = p_period_id and pm.status = 'fixed'
  ), allocated as (
    select *, floor(exact_share) + case when shuttle_discount_percent < 100
      and row_number() over(order by exact_share - floor(exact_share) desc, shuttle_discount_percent, person_id)
        <= v_total - sum(floor(exact_share)) over() then 1 else 0 end as shuttle_share
    from members
  ), participants as (
    select person_id, person, shuttle_discount_percent, shuttle_share from allocated
    union all
    select pe.id, to_jsonb(pe), 100, 0 from public.people pe
    where exists(select 1 from public.shuttle_expenses se where se.period_id = p_period_id
      and se.buyer_id = pe.id and se.total_amount > 0)
      and not exists(select 1 from members m where m.person_id = pe.id)
  ), totals as (
    select p.*, coalesce((select sum(se.total_amount) from public.shuttle_expenses se
      where se.period_id = p_period_id and se.buyer_id = p.person_id), 0) as paid_for_shuttles
    from participants p
  )
  select coalesce(jsonb_agg(jsonb_build_object('person_id', person_id, 'person', person,
    'shuttle_discount_percent', shuttle_discount_percent, 'paid_for_shuttles', paid_for_shuttles,
    'shuttle_share', shuttle_share, 'net_amount', paid_for_shuttles - shuttle_share,
    'result', case when paid_for_shuttles > shuttle_share then 'positive_balance'
      when paid_for_shuttles < shuttle_share then 'need_to_pay' else 'settled' end)
    order by person_id), '[]'::jsonb) into v_details from totals;
  v_unpaid := public.shuttle_unpaid_before_closeout(p_period_id);
  v_fund := public.shuttle_fund_balance(p_period_id);
  return jsonb_build_object('period_id', p_period_id, 'settled', false,
    'fixed_member_count', v_count, 'total_weight', v_weight, 'total_shuttle_amount', v_total,
    'total_shuttle_count', v_shuttles, 'share_per_member', coalesce(v_total / nullif(v_weight, 0), 0),
    'details', v_details, 'fund_balance', v_fund, 'unpaid_before_settlement', v_unpaid,
    'can_settle', v_fund = 0 and jsonb_array_length(v_unpaid) = 0);
end;
$$;

-- Called only after the operator confirms the fund money has been paid to this buyer.
create or replace function public.apply_fund_to_shuttles(p_period_id uuid, p_buyer_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_expense record; v_left numeric := p_amount; v_take numeric; v_fund uuid; v_status text;
begin
  perform public.lock_shuttle_finance(p_period_id);
  select status::text into v_status from public.periods where id = p_period_id for update;
  if v_status <> 'open' or exists(select 1 from public.shuttle_settlement_runs where period_id = p_period_id) then
    raise exception 'Chi duoc dung quy du truoc khi chot cau'; end if;
  if jsonb_array_length(public.shuttle_unpaid_before_closeout(p_period_id)) > 0 then
    raise exception 'Can thu het cong no va tien muon cau truoc khi dung quy du'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then raise exception 'So tien khong hop le'; end if;
  if p_amount > public.shuttle_fund_balance(p_period_id) then raise exception 'So tien vuot quy du'; end if;
  if not exists(select 1 from public.people where id = p_buyer_id and status = 'active') then
    raise exception 'Nguoi mua khong hoat dong'; end if;
  if p_amount > coalesce((select sum(total_amount) from public.shuttle_expenses
      where period_id = p_period_id and buyer_id = p_buyer_id), 0) then
    raise exception 'So tien vuot phan nguoi mua da ung'; end if;
  insert into public.club_fund_transactions(period_id, person_id, transaction_type, amount, description)
    values (p_period_id, p_buyer_id, 'expense', p_amount, 'Quy du bu tien cau da ung truoc khi chia cau') returning id into v_fund;
  perform set_config('app.shuttle_fund_allocation', 'on', true);
  for v_expense in select id, total_amount from public.shuttle_expenses
    where period_id = p_period_id and buyer_id = p_buyer_id and total_amount > 0 order by buy_date, id for update
  loop
    exit when v_left = 0;
    v_take := least(v_left, v_expense.total_amount);
    update public.shuttle_expenses set total_amount = total_amount - v_take where id = v_expense.id;
    insert into public.shuttle_fund_allocations(period_id, buyer_id, expense_id, amount, fund_transaction_id)
      values(p_period_id, p_buyer_id, v_expense.id, v_take, v_fund);
    v_left := v_left - v_take;
  end loop;
  return public.preview_shuttle_period(p_period_id);
end;
$$;

create or replace function public.create_shuttle_loan(p_period_id uuid, p_person_id uuid,
  p_quantity integer, p_unit_price numeric, p_borrowed_at date, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_period public.periods%rowtype; v_loan public.shuttle_loans%rowtype;
begin
  perform public.lock_shuttle_finance(p_period_id);
  select * into v_period from public.periods where id = p_period_id for update;
  if v_period.status <> 'open' or exists(select 1 from public.shuttle_settlement_runs where period_id = p_period_id) then
    raise exception 'Ky da chot, khong the ghi muon cau'; end if;
  if p_borrowed_at is null or p_borrowed_at > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Ngay muon khong hop le'; end if;
  if not exists(select 1 from public.people pe join public.person_groups pg on pg.person_id = pe.id
    where pe.id = p_person_id and pe.status = 'active' and pg.status = 'active' and pg.group_id = v_period.group_id) then
    raise exception 'Nguoi dai dien phai la thanh vien dang hoat dong cua nhom'; end if;
  insert into public.shuttle_loans(period_id, person_id, quantity, unit_price, borrowed_at, note)
    values(p_period_id, p_person_id, p_quantity, p_unit_price, p_borrowed_at, nullif(trim(p_note), '')) returning * into v_loan;
  return to_jsonb(v_loan);
end;
$$;

create or replace function public.repay_shuttle_loan(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loan public.shuttle_loans%rowtype; v_fund uuid; v_period uuid;
begin
  select period_id into v_period from public.shuttle_loans where id = p_id;
  if not found then raise exception 'Khong tim thay khoan muon'; end if;
  perform public.lock_shuttle_finance(v_period);
  select * into v_loan from public.shuttle_loans where id = p_id for update;
  if v_loan.status = 'paid' then return to_jsonb(v_loan); end if;
  if v_loan.status <> 'unpaid' then raise exception 'Khoan muon da huy'; end if;
  insert into public.club_fund_transactions(period_id, person_id, transaction_type, amount, description)
    values(v_loan.period_id, v_loan.person_id, 'income', v_loan.amount,
      'Tra tien muon ' || v_loan.quantity || ' qua cau [shuttle_loan:' || v_loan.id || ']') returning id into v_fund;
  update public.shuttle_loans set status = 'paid', paid_at = now(), fund_transaction_id = v_fund
    where id = p_id returning * into v_loan;
  return to_jsonb(v_loan);
end;
$$;

create or replace function public.cancel_shuttle_loan(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loan public.shuttle_loans%rowtype; v_period uuid;
begin
  select period_id into v_period from public.shuttle_loans where id = p_id;
  if not found then raise exception 'Khong tim thay khoan muon'; end if;
  perform public.lock_shuttle_finance(v_period);
  select * into v_loan from public.shuttle_loans where id = p_id for update;
  if v_loan.status = 'paid' then raise exception 'Khoan muon da tra khong the huy'; end if;
  update public.shuttle_loans set status = 'cancelled' where id = p_id returning * into v_loan;
  return to_jsonb(v_loan);
end;
$$;


-- Manual collection must not mark debts paid before a fund write can succeed.
create or replace function public.deposit_fund_atomic(p_period_id uuid, p_person_id uuid,
  p_amount numeric, p_debt_ids uuid[] default '{}', p_description text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_debt record; v_total numeric := 0; v_count integer := 0;
  v_ids uuid[] := coalesce(p_debt_ids, '{}'); v_funds jsonb := '[]'; v_fund public.club_fund_transactions%rowtype;
begin
  perform public.lock_shuttle_finance(p_period_id);
  select group_id into v_group from public.periods where id = p_period_id for update;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then raise exception 'So tien nop khong hop le'; end if;
  if not exists(select 1 from public.people where id = p_person_id and status = 'active') then
    raise exception 'Nguoi nop khong hoat dong'; end if;
  if cardinality(v_ids) <> (select count(distinct id) from unnest(v_ids) id) then
    raise exception 'Danh sach no bi trung hoac khong hop le'; end if;
  for v_debt in select d.* from public.debts d join public.periods p on p.id = d.period_id
    where d.id = any(v_ids) and d.person_id = p_person_id and d.status = 'unpaid'
      and p.group_id is not distinct from v_group for update of d
  loop v_total := v_total + v_debt.amount; v_count := v_count + 1; end loop;
  if v_count <> cardinality(v_ids) then raise exception 'Khoan no da tra hoac khong thuoc nguoi/nhom nay'; end if;
  if p_amount < v_total then raise exception 'So tien nop phai du thanh toan cac khoan da chon'; end if;
  for v_debt in select * from public.debts where id = any(v_ids) order by id
  loop
    update public.debts set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now() where id = v_debt.id;
    insert into public.club_fund_transactions(period_id, person_id, debt_id, transaction_type, amount, description)
      values(p_period_id, p_person_id, v_debt.id, 'income', v_debt.amount,
        coalesce(nullif(trim(p_description), ''), 'Thu tien - ' || coalesce(v_debt.description, v_debt.debt_type::text)))
      returning * into v_fund;
    v_funds := v_funds || jsonb_build_array(to_jsonb(v_fund));
  end loop;
  if p_amount > v_total then
    insert into public.club_fund_transactions(period_id, person_id, transaction_type, amount, description)
      values(p_period_id, p_person_id, 'income', p_amount - v_total, nullif(trim(p_description), '')) returning * into v_fund;
    v_funds := v_funds || jsonb_build_array(to_jsonb(v_fund));
  end if;
  return jsonb_build_object('fund_transactions', v_funds, 'paid_debt_count', v_count);
end;
$$;
revoke all on function public.deposit_fund_atomic(uuid,uuid,numeric,uuid[],text) from public, anon, authenticated;
grant execute on function public.deposit_fund_atomic(uuid,uuid,numeric,uuid[],text) to service_role;

create or replace function public.create_shuttle_expense_with_fund(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_period uuid := (p_payload->>'period_id')::uuid; v_expense public.shuttle_expenses%rowtype;
  v_new public.shuttle_expenses%rowtype;
  v_fund public.club_fund_transactions%rowtype; v_person uuid := (p_payload->>'buyer_id')::uuid;
  v_personal numeric := (p_payload->>'personal_amount')::numeric; v_fund_amount numeric := (p_payload->>'fund_amount')::numeric;
begin
  perform public.lock_shuttle_finance(v_period);
  perform 1 from public.periods where id = v_period and status = 'open' for update;
  if not found or exists(select 1 from public.shuttle_settlement_runs where period_id = v_period) then
    raise exception 'Ky da chot, khong the mua cau'; end if;
  if v_personal < 0 or v_fund_amount < 0 or v_personal + v_fund_amount <= 0 then raise exception 'So tien mua cau khong hop le'; end if;
  if not exists(select 1 from public.period_members pm join public.people pe on pe.id = pm.person_id
    where pm.period_id = v_period and pm.person_id = v_person and pm.status = 'fixed' and pe.status = 'active') then
    raise exception 'Nguoi mua phai la thanh vien co dinh dang hoat dong'; end if;
  v_new := jsonb_populate_record(null::public.shuttle_expenses, p_payload);
  insert into public.shuttle_expenses(period_id,buyer_id,buy_type,tube_count,shuttle_per_tube,single_count,total_amount,buy_date,note)
    values(v_period,v_person,v_new.buy_type,v_new.tube_count,v_new.shuttle_per_tube,
      v_new.single_count,v_personal,v_new.buy_date,v_new.note) returning * into v_expense;
  if v_fund_amount > 0 then
    insert into public.club_fund_transactions(period_id,person_id,transaction_type,amount,description)
      values(v_period,v_person,'expense',v_fund_amount,
        'Mua cau (quy chi)' || coalesce(' - ' || nullif(p_payload->>'note',''),'')) returning * into v_fund;
  end if;
  return jsonb_build_object('shuttle_expense', to_jsonb(v_expense), 'fund_transaction', to_jsonb(v_fund));
end;
$$;
revoke all on function public.create_shuttle_expense_with_fund(jsonb) from public, anon, authenticated;
grant execute on function public.create_shuttle_expense_with_fund(jsonb) to service_role;
-- Settlement implementation and write guards are defined below.

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
  perform public.lock_shuttle_finance(p_period_id);
  select * into v_period
  from public.periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'Ky khong ton tai';
  end if;

  if v_period.status <> 'open' then
    raise exception 'Ky phai dang mo de chia cau';
  end if;

  if exists (select 1 from public.shuttle_settlement_runs where period_id = p_period_id) then
    raise exception 'Ky nay da chot tien cau roi';
  end if;

  if jsonb_array_length(public.shuttle_unpaid_before_closeout(p_period_id)) > 0 then
    raise exception 'Can thu het cong no va tien muon cau truoc khi chia cau';
  end if;
  if public.shuttle_fund_balance(p_period_id) <> 0 then
    raise exception 'Quy phai bang 0 truoc khi chia cau. Dung quy du bu tien cau hoac doi soat quy am';
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

  perform set_config('app.shuttle_settle', 'on', true);
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
    'allocation_method', 'weighted_shares',
    'total_weight', v_preview->'total_weight',
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


create or replace function public.period_finance_readiness(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_fund numeric; v_settled boolean; v_needs boolean;
begin
  if not exists(select 1 from public.periods where id = p_period_id) then raise exception 'Ky khong ton tai'; end if;
  v_fund := public.shuttle_fund_balance(p_period_id);
  v_settled := exists(select 1 from public.shuttle_settlement_runs where period_id = p_period_id);
  v_needs := exists(select 1 from public.period_members where period_id = p_period_id and status = 'fixed')
    or exists(select 1 from public.shuttle_expenses where period_id = p_period_id);
  return jsonb_build_object('fund_balance', v_fund, 'settled', v_settled,
    'unpaid_before_settlement', public.shuttle_unpaid_before_closeout(p_period_id),
    'can_close', v_fund = 0 and (v_settled or not v_needs)
      and not exists(select 1 from public.shuttle_loans where period_id = p_period_id and status = 'unpaid'));
end;
$$;

create or replace function public.assert_new_period_open(p_group_id uuid, p_exclude_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_previous public.periods%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('shuttle-finance:' || coalesce(p_group_id::text, 'legacy'), 0));
  if exists(select 1 from public.periods where group_id is not distinct from p_group_id
    and status = 'open' and (p_exclude_id is null or id <> p_exclude_id)) then
    raise exception 'Can chot cau va dong ky dang mo truoc khi mo ky moi';
  end if;
  select * into v_previous from public.periods where group_id is not distinct from p_group_id
    and status = 'closed' and (p_exclude_id is null or id <> p_exclude_id) order by start_date desc limit 1;
  if found and public.shuttle_fund_balance(v_previous.id) <> 0 then
    raise exception 'Quy ky truoc phai bang 0 truoc khi mo ky moi';
  end if;
  return true;
end;
$$;

create or replace function public.guard_period_closeout()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ready jsonb;
begin
  if TG_OP = 'UPDATE' and NEW.status = OLD.status then return NEW; end if;
  if TG_OP = 'UPDATE' and NEW.status = 'draft' and OLD.status <> 'draft' then
    raise exception 'Ky da mo khong the chuyen ve ban nhap'; end if;
  if NEW.status = 'open' then
    if TG_OP = 'UPDATE' and exists(select 1 from public.shuttle_settlement_runs where period_id = OLD.id) then
      raise exception 'Ky da chia cau khong the mo lai'; end if;
    perform public.assert_new_period_open(NEW.group_id, NEW.id);
  elsif NEW.status = 'closed' then
    if TG_OP = 'INSERT' then raise exception 'Tao ky nhap truoc khi chot'; end if;
    perform public.lock_shuttle_finance(NEW.id);
    v_ready := public.period_finance_readiness(NEW.id);
    if not (v_ready->>'can_close')::boolean then
      raise exception 'Can chia cau, tra het tien muon cau va dua quy ve 0 truoc khi dong ky'; end if;
    if not (v_ready->>'settled')::boolean and jsonb_array_length(v_ready->'unpaid_before_settlement') > 0 then
      raise exception 'Can thu het cong no truoc khi dong ky'; end if;
  end if;
  return NEW;
end;
$$;
create trigger periods_closeout_guard before insert or update of status on public.periods
for each row execute function public.guard_period_closeout();

-- Finance mutations take the same group lock as settlement so new debt/income
-- cannot slip between eligibility checks and the final calculation.
create or replace function public.guard_closeout_finance_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_period uuid; v_status text; v_group uuid; v_target uuid;
begin
  if TG_OP = 'DELETE' then v_period := OLD.period_id; else v_period := NEW.period_id; end if;
  if v_period is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;
  perform public.lock_shuttle_finance(v_period);
  select status::text, group_id into v_status, v_group from public.periods where id = v_period for update;
  if TG_OP = 'UPDATE' and NEW.period_id is distinct from OLD.period_id then
    raise exception 'Khong duoc chuyen but toan sang ky khac'; end if;
  if TG_TABLE_NAME = 'club_fund_transactions' then
    if TG_OP <> 'INSERT' then
      if exists(select 1 from public.shuttle_fund_allocations where fund_transaction_id = OLD.id)
        or exists(select 1 from public.shuttle_loans where fund_transaction_id = OLD.id) then
        raise exception 'But toan lien ket muon cau hoac bu tien cau khong the sua/xoa'; end if;
    end if;
    if v_status = 'closed' then
      if TG_OP = 'INSERT' and NEW.transaction_type::text = 'income' then
        select id into v_target from public.periods where group_id is not distinct from v_group
          and status = 'open' order by start_date desc limit 1;
        if v_target is null then raise exception 'Mo ky moi truoc khi ghi thu tien no cu'; end if;
        NEW.period_id := v_target;
      else raise exception 'Ky da dong, ghi dieu chinh vao ky dang mo'; end if;
    elsif v_status <> 'open' then raise exception 'Chi duoc ghi quy vao ky dang mo'; end if;
  elsif TG_TABLE_NAME = 'shuttle_expenses' then
    if v_status <> 'open' or exists(select 1 from public.shuttle_settlement_runs where period_id = v_period) then
      raise exception 'Ky da chot, khong the doi chi phi cau'; end if;
    if TG_OP <> 'INSERT' and exists(select 1 from public.shuttle_fund_allocations where expense_id = OLD.id)
      and current_setting('app.shuttle_fund_allocation', true) is distinct from 'on' then
      raise exception 'Chi phi da bu tu quy, khong the sua/xoa'; end if;
  elsif TG_TABLE_NAME = 'debts' then
    if TG_OP = 'INSERT' and (v_status <> 'open'
      or (exists(select 1 from public.shuttle_settlement_runs where period_id = v_period)
        and current_setting('app.shuttle_settle', true) is distinct from 'on')) then
      raise exception 'Ky da chot, tao khoan no moi trong ky dang mo'; end if;
    if TG_OP = 'UPDATE' and NEW.status = 'unpaid'
      and (OLD.status <> 'unpaid' or NEW.amount > OLD.amount)
      and exists(select 1 from public.shuttle_settlement_runs where period_id = v_period) then
      raise exception 'Ky da chot, khong the mo lai hoac sua khoan no'; end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;
create trigger fund_closeout_write_guard before insert or update or delete on public.club_fund_transactions
for each row execute function public.guard_closeout_finance_write();
create trigger debt_closeout_write_guard before insert or update or delete on public.debts
for each row execute function public.guard_closeout_finance_write();
create trigger shuttle_expense_closeout_write_guard before insert or update or delete on public.shuttle_expenses
for each row execute function public.guard_closeout_finance_write();

revoke all on function public.shuttle_fund_balance(uuid), public.lock_shuttle_finance(uuid),
  public.shuttle_unpaid_before_closeout(uuid), public.preview_shuttle_period(uuid),
  public.apply_fund_to_shuttles(uuid, uuid, numeric),
  public.create_shuttle_loan(uuid, uuid, integer, numeric, date, text),
  public.repay_shuttle_loan(uuid), public.cancel_shuttle_loan(uuid),
  public.period_finance_readiness(uuid), public.assert_new_period_open(uuid, uuid),
  public.settle_shuttle_period(uuid), public.guard_period_closeout(), public.guard_closeout_finance_write()
  from public, anon, authenticated;
grant execute on function public.shuttle_fund_balance(uuid), public.lock_shuttle_finance(uuid),
  public.shuttle_unpaid_before_closeout(uuid), public.preview_shuttle_period(uuid),
  public.apply_fund_to_shuttles(uuid, uuid, numeric),
  public.create_shuttle_loan(uuid, uuid, integer, numeric, date, text),
  public.repay_shuttle_loan(uuid), public.cancel_shuttle_loan(uuid),
  public.period_finance_readiness(uuid), public.assert_new_period_open(uuid, uuid),
  public.settle_shuttle_period(uuid) to service_role;
commit;
