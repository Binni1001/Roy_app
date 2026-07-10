-- ============================================================
-- 20260710_shuttle_debt_only.sql
-- SỬA GỐC double-booking tiền cầu (Cách A):
--   Chốt cầu CHỈ tạo NỢ cho người đóng thiếu, KHÔNG đụng "số dư" (person_balances).
--   Người mua cầu nhiều -> CLB hoàn lại qua QUỸ (nút "Hoàn tiền"), không ghi số dư.
--   => Hết cảnh "trả nợ rồi mà số dư vẫn âm".
--
-- Gồm 3 phần:
--   1) settle_shuttle_period: chỉ tạo nợ (net<0), bỏ mọi ghi person_balances/balance_transactions
--   2) process_paid_payment: bỏ đoạn "hoàn số dư khi trả nợ tiền cầu" (không còn cần)
--   3) Dọn số dư âm cũ: gỡ các bút toán tiền cầu phía người thiếu -> số dư về đúng, GIỮ nợ
-- ============================================================

-- ---------- 1) CHỐT CẦU: CHỈ TẠO NỢ ----------
create or replace function public.settle_shuttle_period(p_period_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_member_count integer;
  v_total_amount numeric;
  v_total_shuttles integer;
  v_share numeric;
  v_item record;
  v_results jsonb := '[]'::jsonb;
  v_preview_details jsonb := '[]'::jsonb;
begin
  -- Idempotency: đã có nợ tiền cầu (chưa hủy) của kỳ => đã chốt rồi
  if exists (
    select 1 from public.debts
    where period_id = p_period_id
      and debt_type = 'shuttle_extra'
      and status <> 'cancelled'
  ) then
    raise exception 'Ky nay da chot tien cau roi';
  end if;

  select count(*)
  into v_member_count
  from public.period_members
  where period_id = p_period_id
    and status = 'fixed'
    and exempt_shuttle = false;

  if v_member_count = 0 then
    raise exception 'Ky nay chua co fixed member phai dong tien cau';
  end if;

  select
    coalesce(sum(total_amount), 0),
    coalesce(sum(total_shuttle_count), 0)
  into v_total_amount, v_total_shuttles
  from public.shuttle_expenses
  where period_id = p_period_id;

  v_share := round(v_total_amount / v_member_count);

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
      and pm.exempt_shuttle = false
    group by pm.person_id, pe.id
  loop
    v_preview_details := v_preview_details || jsonb_build_array(jsonb_build_object(
      'person_id', v_item.person_id,
      'person', v_item.person,
      'paid_for_shuttles', v_item.paid_for_shuttles,
      'shuttle_share', v_share,
      'net_amount', v_item.net_amount,
      'result',
        case
          when v_item.net_amount > 0 then 'positive_balance'
          when v_item.net_amount < 0 then 'need_to_pay'
          else 'settled'
        end
    ));

    -- CHỈ tạo NỢ cho người đóng thiếu. Không đụng person_balances.
    if v_item.net_amount < 0 then
      insert into public.debts (period_id, person_id, debt_type, amount, status, description)
      values (p_period_id, v_item.person_id, 'shuttle_extra', abs(v_item.net_amount), 'unpaid', 'Tien cau phai dong them cuoi ky');

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id, 'action', 'created_debt', 'amount', abs(v_item.net_amount)));
    else
      -- Người mua nhiều hơn phần chịu: CLB hoàn qua QUỸ (nút Hoàn tiền), không ghi số dư.
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', case when v_item.net_amount > 0 then 'refund_via_fund' else 'no_action' end,
        'amount', v_item.net_amount));
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'member_count', v_member_count,
    'total_shuttle_amount', v_total_amount,
    'total_shuttles', v_total_shuttles,
    'share_per_member', v_share,
    'preview_details', v_preview_details,
    'results', v_results
  );
end;
$$;

grant execute on function public.settle_shuttle_period(uuid) to service_role;

-- ---------- 2) TRẢ NỢ: BỎ đoạn hoàn số dư tiền cầu ----------
-- (Vì chốt cầu không còn trừ số dư, nên trả nợ cũng không cần cộng lại)
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
    v_description := 'Thu tien ' || v_debt.debt_type::text;

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
        v_debt.period_id, v_debt.person_id, v_payment.id, 'income', v_debt.amount, v_description
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

-- ---------- 3) DỌN SỐ DƯ ÂM CŨ ----------
-- Gỡ tác động tiền cầu PHÍA NGƯỜI THIẾU ra khỏi số dư:
--   - debit_shuttle_share (khoản trừ khi chốt)
--   - credit_from_shuttle_purchase mô tả 'Hoan tra...' (khoản hoàn khi trả nợ)
-- => số dư người thiếu về đúng (thường là 0), NHƯNG GIỮ NGUYÊN nợ để họ đóng.
-- GIỮ NGUYÊN số dư dương của người mua cầu nhiều ('Duong tien...') — đó là tiền thật CLB nợ họ.
do $$
declare
  bt record;
begin
  for bt in
    select * from public.balance_transactions
    where transaction_type = 'debit_shuttle_share'
       or (transaction_type = 'credit_from_shuttle_purchase' and description like 'Hoan tra%')
  loop
    update public.person_balances
    set balance = balance + case when bt.direction = 'plus' then -bt.amount else bt.amount end,
        updated_at = now()
    where person_id = bt.person_id;
  end loop;

  delete from public.balance_transactions
  where transaction_type = 'debit_shuttle_share'
     or (transaction_type = 'credit_from_shuttle_purchase' and description like 'Hoan tra%');
end $$;
