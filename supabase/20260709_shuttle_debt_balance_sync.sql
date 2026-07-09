-- ============================================================
-- 20260709_shuttle_debt_balance_sync.sql
--
-- VAN DE:
--   Khi chot tien cau (settle_shuttle_period), nguoi thieu tien cau bi ghi
--   khoan thieu vao CA HAI noi:
--     1) Tru vao person_balances.balance  (-> "So du tai khoan" am)
--     2) Tao them mot debt loai 'shuttle_extra' (-> "No can thanh toan")
--   Khi tra debt qua PayOS, process_paid_payment chi doi debt.status = 'paid'
--   ma KHONG cong lai person_balances -> so du bi ket am mai du no da tra.
--
-- CACH SUA:
--   process_paid_payment: khi tra mot debt 'shuttle_extra', cong lai dung
--   so tien do vao person_balances + ghi 1 balance_transaction (idempotent).
--   Cuoi file: backfill cho cac debt 'shuttle_extra' da 'paid' truoc day.
-- ============================================================

create or replace function public.process_paid_payment(
  p_order_code bigint,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_payment public.payments%rowtype;
  v_payment_debt record;
  v_now timestamptz := now();
  v_updated_debts jsonb := '[]'::jsonb;
  v_fund_transactions jsonb := '[]'::jsonb;
  v_debt public.debts%rowtype;
  v_fund public.club_fund_transactions%rowtype;
  v_description text;
  v_balance_marker text;
begin
  select *
  into v_payment
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

  for v_payment_debt in
    select pd.*, d.*
    from public.payment_debts pd
    join public.debts d on d.id = pd.debt_id
    where pd.payment_id = v_payment.id
    for update of d
  loop
    update public.debts
    set
      status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      updated_at = v_now
    where id = v_payment_debt.debt_id
    returning *
    into v_debt;

    v_updated_debts := v_updated_debts || jsonb_build_array(to_jsonb(v_debt));
    v_description := 'Thu tien ' || v_debt.debt_type::text;

    -- ==== FIX: hoan lai so du khi tra no tien cau ====
    -- Khoan thieu tien cau da bi tru vao person_balances luc chot ky.
    -- Nay no da tra -> cong lai dung so tien do de so du ve dung.
    -- Idempotent: chi lam neu chua co giao dich hoan tra cho debt nay.
    if v_debt.debt_type = 'shuttle_extra' then
      v_balance_marker :=
        'Hoan tra so du sau khi tra no tien cau (debt ' || v_debt.id || ')';

      if not exists (
        select 1
        from public.balance_transactions
        where person_id = v_debt.person_id
          and transaction_type = 'credit_from_shuttle_purchase'
          and description = v_balance_marker
      ) then
        insert into public.person_balances (person_id, balance)
        values (v_debt.person_id, v_debt.amount)
        on conflict (person_id)
        do update set
          balance = public.person_balances.balance + excluded.balance,
          updated_at = v_now;

        insert into public.balance_transactions (
          person_id,
          period_id,
          transaction_type,
          amount,
          direction,
          description
        )
        values (
          v_debt.person_id,
          v_debt.period_id,
          'credit_from_shuttle_purchase',
          v_debt.amount,
          'plus',
          v_balance_marker
        );
      end if;
    end if;
    -- ==== END FIX ====

    select *
    into v_fund
    from public.club_fund_transactions
    where payment_id = v_payment.id
      and person_id = v_debt.person_id
      and amount = v_debt.amount
      and transaction_type = 'income'
    limit 1;

    if not found then
      insert into public.club_fund_transactions (
        period_id,
        person_id,
        payment_id,
        transaction_type,
        amount,
        description
      )
      values (
        v_debt.period_id,
        v_debt.person_id,
        v_payment.id,
        'income',
        v_debt.amount,
        v_description
      )
      returning *
      into v_fund;
    end if;

    v_fund_transactions :=
      v_fund_transactions || jsonb_build_array(to_jsonb(v_fund));
  end loop;

  update public.payments
  set
    status = 'paid',
    paid_at = coalesce(paid_at, v_now),
    raw_payload = p_raw_payload,
    updated_at = v_now
  where id = v_payment.id
  returning *
  into v_payment;

  return jsonb_build_object(
    'message', 'PayOS webhook processed',
    'payment', to_jsonb(v_payment),
    'updated_debts', v_updated_debts,
    'fund_transactions', v_fund_transactions
  );
end;
$$;

grant execute on function public.process_paid_payment(bigint, jsonb) to service_role;

-- ============================================================
-- BACKFILL: hoan lai so du cho cac debt 'shuttle_extra' DA 'paid'
-- truoc khi co ban va nay (vd khoan -145.000 hien tai).
-- Idempotent: bo qua debt da co giao dich hoan tra.
-- ============================================================
do $$
declare
  r record;
  v_marker text;
begin
  for r in
    select *
    from public.debts
    where debt_type = 'shuttle_extra'
      and status = 'paid'
  loop
    v_marker := 'Hoan tra so du sau khi tra no tien cau (debt ' || r.id || ')';

    if not exists (
      select 1
      from public.balance_transactions
      where person_id = r.person_id
        and transaction_type = 'credit_from_shuttle_purchase'
        and description = v_marker
    ) then
      insert into public.person_balances (person_id, balance)
      values (r.person_id, r.amount)
      on conflict (person_id)
      do update set
        balance = public.person_balances.balance + excluded.balance,
        updated_at = now();

      insert into public.balance_transactions (
        person_id,
        period_id,
        transaction_type,
        amount,
        direction,
        description
      )
      values (
        r.person_id,
        r.period_id,
        'credit_from_shuttle_purchase',
        r.amount,
        'plus',
        v_marker
      );
    end if;
  end loop;
end $$;
