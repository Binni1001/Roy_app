-- ============================================================
-- 20260710_pay_into_open_period.sql
-- Khi trả một khoản nợ mà KỲ GỐC của nợ đã "closed", tiền thu vào quỹ sẽ
-- được ghi vào KỲ ĐANG MỞ (open) thay vì kỳ đã chốt.
-- => Kỳ đã chốt giữ nguyên số 0 sau khi kết chuyển; tiền trả trễ chảy vào
--    kỳ hiện tại (đúng dòng tiền thực).
-- Nếu kỳ gốc vẫn 'open' hoặc không có kỳ open nào -> giữ nguyên kỳ gốc.
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
  v_debt_period_status text;
  v_open_period uuid;
  v_target_period uuid;
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

  -- Kỳ đang mở gần nhất (nếu có)
  select id into v_open_period
  from public.periods
  where status = 'open'
  order by start_date desc
  limit 1;

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

    -- Xác định kỳ ghi nhận tiền vào quỹ:
    -- kỳ gốc nếu còn 'open', ngược lại vào kỳ đang mở (nếu có).
    select status into v_debt_period_status
    from public.periods where id = v_debt.period_id;

    if v_debt_period_status = 'open' or v_open_period is null then
      v_target_period := v_debt.period_id;
    else
      v_target_period := v_open_period;
    end if;

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
        period_id, person_id, payment_id, transaction_type, amount, description
      )
      values (
        v_target_period, v_debt.person_id, v_payment.id, 'income', v_debt.amount, v_description
      )
      returning *
      into v_fund;
    end if;

    v_fund_transactions := v_fund_transactions || jsonb_build_array(to_jsonb(v_fund));
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
