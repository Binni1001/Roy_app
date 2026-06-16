-- ============================================================
-- MIGRATION: 20260617_fund_description.sql
-- Fix: process_paid_payment ghi mo ta giao dich quy qua chung
-- (vi du "Thu tien monthly_fee") thay vi dung mo ta that cua khoan no
-- (vi du "Tien co dinh Thang 6 do mau"), nen Sổ quỹ kho doc duoc
-- noi dung thuc te cua giao dich.
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

    -- FIX: dung mo ta that cua khoan no (da co san, de hieu) thay vi
    -- chi ghi loai no tho ("Thu tien monthly_fee")
    if v_debt.description is not null and v_debt.description <> '' then
      v_description := 'Thu tien - ' || v_debt.description;
    else
      v_description := 'Thu tien ' || v_debt.debt_type::text;
    end if;

    -- FIX: dùng debt_id để check duplicate thay vì chỉ dùng amount
    select *
    into v_fund
    from public.club_fund_transactions
    where payment_id = v_payment.id
      and debt_id = v_debt.id
    limit 1;

    if not found then
      insert into public.club_fund_transactions (
        period_id,
        person_id,
        payment_id,
        debt_id,
        transaction_type,
        amount,
        description
      )
      values (
        v_debt.period_id,
        v_debt.person_id,
        v_payment.id,
        v_debt.id,
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
