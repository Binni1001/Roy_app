-- PayOS payment hardening.
--
-- 1. process_paid_payment / mark_payment_failed were SECURITY DEFINER but never had
--    EXECUTE revoked from PUBLIC/anon/authenticated, so any client holding the public
--    anon key could call them through PostgREST. Only service_role may call them now.
-- 2. Payment creation is atomic: payment + payment_debts are written in one RPC while
--    holding row locks, so a failure can no longer leave a payment without its debts,
--    and two concurrent requests cannot create two links for the same debts.
-- 3. Order codes come from a sequence (no millisecond collisions) and are unique.
-- 4. process_paid_payment verifies the paid amount, ignores replays and refuses to
--    pay debts that were already settled (returns processed=false for reconciliation).
-- 5. mark_payment_failed can no longer downgrade a payment that is already paid.
--
-- Safe to re-run. Apply in the Supabase SQL Editor; no data is modified except
-- the (re)definition of functions, one sequence and one unique index.

-- Columns that are filled after PayOS responds must allow null at creation time.
alter table public.payments alter column payos_checkout_url drop not null;
alter table public.payments alter column payos_qr_code drop not null;
alter table public.payments alter column raw_payload drop not null;

-- Legacy codes were the last 10 digits of Date.now() (< 10^10); start above them.
create sequence if not exists public.payos_order_code_seq
  as bigint start with 10000000000 minvalue 10000000000;

do $$
begin
  if exists (
    select payos_order_code from public.payments
    where payos_order_code is not null
    group by payos_order_code having count(*) > 1
  ) then
    raise notice 'Duplicate payos_order_code values exist; resolve them, then re-run to create the unique index.';
  else
    create unique index if not exists payments_payos_order_code_key
      on public.payments (payos_order_code)
      where payos_order_code is not null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic creation of a pending payment for a set of unpaid debts.
-- Lock order is payments -> debts (same as process_paid_payment) to avoid deadlocks.
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_payment(
  p_person_id uuid,
  p_debt_ids uuid[],
  p_description text,
  p_return_url text default null,
  p_cancel_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wanted uuid[];
  v_locked uuid[] := '{}';
  v_total numeric := 0;
  v_debt record;
  v_pending record;
  v_old_ids uuid[];
  v_cancelled bigint[] := '{}';
  v_payment public.payments%rowtype;
begin
  select coalesce(array_agg(distinct x order by x), '{}') into v_wanted
  from unnest(coalesce(p_debt_ids, '{}')) as x;

  if cardinality(v_wanted) = 0 then
    raise exception 'NO_DEBTS' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('payos:' || p_person_id::text, 0));

  -- Lock this person's pending payments first.
  perform 1 from public.payments
  where person_id = p_person_id and status::text = 'pending'
  for update;

  for v_debt in
    select id, amount from public.debts
    where id = any (v_wanted) and person_id = p_person_id and status::text = 'unpaid'
    order by id
    for update
  loop
    if v_debt.amount is null or v_debt.amount <= 0 then
      raise exception 'INVALID_DEBT_AMOUNT' using errcode = '22023';
    end if;
    v_locked := v_locked || v_debt.id;
    v_total := v_total + v_debt.amount;
  end loop;

  if cardinality(v_locked) <> cardinality(v_wanted) then
    raise exception 'DEBTS_CHANGED' using errcode = '22023';
  end if;

  -- Reuse an identical pending payment that already has a checkout link.
  for v_pending in
    select * from public.payments
    where person_id = p_person_id and status::text = 'pending'
    order by created_at desc
  loop
    select coalesce(array_agg(debt_id order by debt_id), '{}') into v_old_ids
    from public.payment_debts where payment_id = v_pending.id;

    if v_old_ids = v_locked
       and v_pending.amount = v_total
       and v_pending.payos_checkout_url is not null then
      return jsonb_build_object('reused', true, 'payment', to_jsonb(v_pending),
                                'cancelled_order_codes', '[]'::jsonb);
    end if;
  end loop;

  -- Cancel pending payments that overlap with these debts (PayOS links are
  -- cancelled by the caller using the returned order codes).
  for v_pending in
    select p.* from public.payments p
    where p.person_id = p_person_id and p.status::text = 'pending'
      and exists (
        select 1 from public.payment_debts pd
        where pd.payment_id = p.id and pd.debt_id = any (v_locked)
      )
  loop
    update public.payments set status = 'cancelled', updated_at = now()
    where id = v_pending.id;
    if v_pending.payos_order_code is not null then
      v_cancelled := v_cancelled || v_pending.payos_order_code;
    end if;
  end loop;

  insert into public.payments (
    person_id, amount, status, provider, payos_order_code,
    description, return_url, cancel_url, raw_payload
  )
  values (
    p_person_id, v_total, 'pending', 'payos', nextval('public.payos_order_code_seq'),
    p_description, p_return_url, p_cancel_url, '{}'::jsonb
  )
  returning * into v_payment;

  insert into public.payment_debts (payment_id, debt_id, amount)
  select v_payment.id, d.id, d.amount
  from public.debts d where d.id = any (v_locked);

  return jsonb_build_object('reused', false, 'payment', to_jsonb(v_payment),
                            'cancelled_order_codes', to_jsonb(v_cancelled));
end;
$$;

-- Stores the PayOS link on a payment that is still pending. Returns null when the
-- payment was cancelled meanwhile (the caller then cancels the PayOS link).
create or replace function public.attach_payos_link(
  p_payment_id uuid,
  p_checkout_url text,
  p_qr_code text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  update public.payments
  set payos_checkout_url = p_checkout_url,
      payos_qr_code = p_qr_code,
      raw_payload = p_raw_payload,
      updated_at = now()
  where id = p_payment_id and status::text = 'pending'
  returning * into v_payment;

  if not found then
    return null;
  end if;
  return to_jsonb(v_payment);
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook: successful payment.
-- ---------------------------------------------------------------------------
create or replace function public.process_paid_payment(
  p_order_code bigint,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_previous_status text;
  v_paid_amount numeric;
  v_debt_count integer;
  v_not_unpaid integer;
  v_payment_debt record;
  v_now timestamptz := now();
  v_updated_debts jsonb := '[]'::jsonb;
  v_fund_transactions jsonb := '[]'::jsonb;
  v_debt public.debts%rowtype;
  v_fund public.club_fund_transactions%rowtype;
  v_description text;
  v_debt_period_status text;
  v_group_id uuid;
  v_open_period uuid;
  v_target_period uuid;
begin
  select * into v_payment
  from public.payments
  where payos_order_code = p_order_code
  for update;

  if not found then
    return jsonb_build_object(
      'test_webhook', true,
      'message', 'Payment order code does not exist',
      'order_code', p_order_code
    );
  end if;

  if v_payment.status::text = 'paid' then
    return jsonb_build_object(
      'processed', true,
      'already_processed', true,
      'message', 'Payment already processed',
      'payment', to_jsonb(v_payment)
    );
  end if;

  v_previous_status := v_payment.status::text;
  v_paid_amount := nullif(p_raw_payload #>> '{data,amount}', '')::numeric;

  if v_paid_amount is distinct from v_payment.amount then
    update public.payments set raw_payload = p_raw_payload, updated_at = v_now
    where id = v_payment.id;
    return jsonb_build_object(
      'processed', false,
      'error_code', 'AMOUNT_MISMATCH',
      'order_code', p_order_code,
      'expected_amount', v_payment.amount,
      'received_amount', v_paid_amount
    );
  end if;

  -- Lock the linked debts and make sure all of them are still payable.
  select count(*), count(*) filter (where x.status <> 'unpaid')
  into v_debt_count, v_not_unpaid
  from (
    select d.status::text as status
    from public.payment_debts pd
    join public.debts d on d.id = pd.debt_id
    where pd.payment_id = v_payment.id
    for update of d
  ) x;

  if v_debt_count = 0 or v_not_unpaid > 0 then
    update public.payments set raw_payload = p_raw_payload, updated_at = v_now
    where id = v_payment.id;
    return jsonb_build_object(
      'processed', false,
      'error_code', 'REQUIRES_RECONCILIATION',
      'order_code', p_order_code,
      'payment_status', v_previous_status,
      'debt_count', v_debt_count,
      'settled_debt_count', v_not_unpaid
    );
  end if;

  select p.group_id into v_group_id
  from public.payment_debts pd
  join public.debts d on d.id = pd.debt_id
  join public.periods p on p.id = d.period_id
  where pd.payment_id = v_payment.id
  limit 1;

  select id into v_open_period
  from public.periods
  where status = 'open'
    and group_id is not distinct from v_group_id
  order by start_date desc
  limit 1;

  for v_payment_debt in
    select pd.debt_id
    from public.payment_debts pd
    join public.debts d on d.id = pd.debt_id
    where pd.payment_id = v_payment.id
    order by pd.debt_id
  loop
    update public.debts
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        updated_at = v_now
    where id = v_payment_debt.debt_id
    returning * into v_debt;

    v_updated_debts := v_updated_debts || jsonb_build_array(to_jsonb(v_debt));

    if v_debt.description is not null and v_debt.description <> '' then
      v_description := 'Thu tien - ' || v_debt.description;
    else
      v_description := 'Thu tien ' || v_debt.debt_type::text;
    end if;

    select status::text into v_debt_period_status
    from public.periods where id = v_debt.period_id;

    if v_debt_period_status = 'open' or v_open_period is null then
      v_target_period := v_debt.period_id;
    else
      v_target_period := v_open_period;
    end if;

    select * into v_fund
    from public.club_fund_transactions
    where payment_id = v_payment.id and debt_id = v_debt.id
    limit 1;

    if not found then
      insert into public.club_fund_transactions (
        period_id, person_id, payment_id, debt_id,
        transaction_type, amount, description
      )
      values (
        v_target_period, v_debt.person_id, v_payment.id, v_debt.id,
        'income', v_debt.amount, v_description
      )
      returning * into v_fund;
    end if;

    v_fund_transactions := v_fund_transactions || jsonb_build_array(to_jsonb(v_fund));
  end loop;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      raw_payload = p_raw_payload,
      updated_at = v_now
  where id = v_payment.id
  returning * into v_payment;

  return jsonb_build_object(
    'processed', true,
    'message', 'PayOS webhook processed',
    'previous_status', v_previous_status,
    'payment', to_jsonb(v_payment),
    'updated_debts', v_updated_debts,
    'fund_transactions', v_fund_transactions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook: unsuccessful payment. Only a pending payment can become failed.
-- ---------------------------------------------------------------------------
create or replace function public.mark_payment_failed(
  p_order_code bigint,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment
  from public.payments
  where payos_order_code = p_order_code
  for update;

  if not found then
    return jsonb_build_object(
      'test_webhook', true,
      'message', 'Payment order code does not exist',
      'order_code', p_order_code
    );
  end if;

  if v_payment.status::text <> 'pending' then
    return jsonb_build_object(
      'ignored', true,
      'message', 'Payment is not pending; failure notice ignored',
      'payment', to_jsonb(v_payment)
    );
  end if;

  update public.payments
  set status = 'failed', raw_payload = p_raw_payload, updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  return jsonb_build_object('message', 'Payment failed', 'payment', to_jsonb(v_payment));
end;
$$;

-- Only the backend (service role) may run payment functions.
revoke all on function public.create_pending_payment(uuid, uuid[], text, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_payos_link(uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.process_paid_payment(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_payment_failed(bigint, jsonb)
  from public, anon, authenticated;

grant execute on function public.create_pending_payment(uuid, uuid[], text, text, text) to service_role;
grant execute on function public.attach_payos_link(uuid, text, text, jsonb) to service_role;
grant execute on function public.process_paid_payment(bigint, jsonb) to service_role;
grant execute on function public.mark_payment_failed(bigint, jsonb) to service_role;
