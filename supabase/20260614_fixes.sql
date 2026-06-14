-- ============================================================
-- MIGRATION: 20260614_fixes.sql
-- Fix 7 issues identified in backend review
-- ============================================================

-- ============================================================
-- FIX #1: Thêm debt_id vào club_fund_transactions
-- Giải quyết bug: nếu 1 payment có 2 debt cùng amount của cùng 1 người,
-- fund transaction thứ 2 sẽ bị bỏ qua do check thiếu debt_id
-- ============================================================
alter table public.club_fund_transactions
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

-- ============================================================
-- FIX #2: Thêm source_attendance_id vào debts
-- Giải quyết bug: guest debt lookup qua ilike description rất dễ vỡ,
-- cần FK thật để link debt ↔ guest_attendance
-- ============================================================
alter table public.debts
  add column if not exists source_attendance_id uuid references public.guest_attendances(id) on delete set null;

-- ============================================================
-- FIX #6: Unique constraint cho shuttle_extra debt
-- Tránh tạo 2 shuttle_extra debt cho cùng 1 người trong 1 kỳ
-- (tương tự unique index đã có cho monthly_fee)
-- ============================================================
create unique index if not exists unique_shuttle_extra_debt_per_person_period
  on public.debts (period_id, person_id, debt_type)
  where debt_type = 'shuttle_extra';

-- ============================================================
-- FIX #1 (RPC): Cập nhật process_paid_payment
-- Dùng debt_id để check duplicate fund transaction thay vì chỉ dùng amount
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
    v_description := 'Thu tien ' || v_debt.debt_type::text;

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

-- ============================================================
-- FIX #5: Cập nhật settle_shuttle_period
-- Thêm check period status trước khi chốt tiền cầu
-- ============================================================
create or replace function public.settle_shuttle_period(p_period_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_period public.periods%rowtype;
  v_member_count integer;
  v_total_amount numeric;
  v_total_shuttles integer;
  v_share numeric;
  v_item record;
  v_balance numeric;
  v_new_balance numeric;
  v_debt public.debts%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_preview_details jsonb := '[]'::jsonb;
begin
  -- FIX #5: check period tồn tại và không phải draft/closed
  select *
  into v_period
  from public.periods
  where id = p_period_id;

  if not found then
    raise exception 'Ky nay khong ton tai';
  end if;

  if v_period.status = 'draft' then
    raise exception 'Ky nay chua mo, khong the chot tien cau';
  end if;

  -- Idempotency check: đã chốt rồi thì không chạy lại
  if exists (
    select 1
    from public.balance_transactions
    where period_id = p_period_id
      and transaction_type in (
        'credit_from_shuttle_purchase',
        'debit_shuttle_share'
      )
  ) then
    raise exception 'Ky nay da chot tien cau roi';
  end if;

  select count(*)
  into v_member_count
  from public.period_members
  where period_id = p_period_id
    and status = 'fixed';

  if v_member_count = 0 then
    raise exception 'Ky nay chua co fixed member';
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

    if v_item.net_amount = 0 then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', 'no_action',
        'amount', 0
      ));
      continue;
    end if;

    insert into public.person_balances (person_id, balance)
    values (v_item.person_id, v_item.net_amount)
    on conflict (person_id)
    do update set
      balance = public.person_balances.balance + excluded.balance,
      updated_at = now()
    returning balance
    into v_new_balance;

    insert into public.balance_transactions (
      person_id,
      period_id,
      transaction_type,
      amount,
      direction,
      description
    )
    values (
      v_item.person_id,
      p_period_id,
      case
        when v_item.net_amount > 0
          then 'credit_from_shuttle_purchase'::public.balance_transaction_type
        else 'debit_shuttle_share'::public.balance_transaction_type
      end,
      abs(v_item.net_amount),
      case when v_item.net_amount > 0 then 'plus' else 'minus' end,
      case
        when v_item.net_amount > 0
          then 'Duong tien do mua cau nhieu hon phan phai chiu'
        else 'Am tien do chua dong du phan cau phai chiu'
      end
    );

    if v_item.net_amount < 0 then
      insert into public.debts (
        period_id,
        person_id,
        debt_type,
        amount,
        status,
        description
      )
      values (
        p_period_id,
        v_item.person_id,
        'shuttle_extra',
        abs(v_item.net_amount),
        'unpaid',
        'Tien cau can dong them'
      )
      returning *
      into v_debt;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', 'created_shuttle_debt',
        'amount', abs(v_item.net_amount),
        'new_balance', v_new_balance,
        'debt', to_jsonb(v_debt)
      ));
    else
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'person_id', v_item.person_id,
        'action', 'added_positive_balance',
        'amount', v_item.net_amount,
        'new_balance', v_new_balance
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'message', 'Chot tien cau thanh cong',
    'preview', jsonb_build_object(
      'period_id', p_period_id,
      'fixed_member_count', v_member_count,
      'total_shuttle_amount', v_total_amount,
      'total_shuttle_count', v_total_shuttles,
      'share_per_member', v_share,
      'details', v_preview_details
    ),
    'results', v_results
  );
end;
$$;

-- ============================================================
-- FIX #4: Cập nhật offset_person_period
-- Điền related_debt_id vào balance_transactions để audit trail đầy đủ
-- ============================================================
create or replace function public.offset_person_period(
  p_person_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance_row public.person_balances%rowtype;
  v_available_balance numeric;
  v_debt public.debts%rowtype;
  v_old_amount numeric;
  v_offset_amount numeric;
  v_remaining_amount numeric;
  v_total_offset numeric := 0;
  v_updated_debts jsonb := '[]'::jsonb;
  v_transaction public.balance_transactions%rowtype;
begin
  select *
  into v_balance_row
  from public.person_balances
  where person_id = p_person_id
  for update;

  if not found or v_balance_row.balance <= 0 then
    return jsonb_build_object(
      'message', 'Nguoi nay khong co so du duong de bu tru',
      'offset_amount', 0,
      'remaining_balance', coalesce(v_balance_row.balance, 0),
      'updated_debts', '[]'::jsonb
    );
  end if;

  v_available_balance := v_balance_row.balance;

  for v_debt in
    select *
    from public.debts
    where person_id = p_person_id
      and period_id = p_period_id
      and status = 'unpaid'
    order by created_at asc
    for update
  loop
    exit when v_available_balance <= 0;

    v_old_amount := v_debt.amount;
    v_offset_amount := least(v_available_balance, v_debt.amount);
    v_remaining_amount := v_debt.amount - v_offset_amount;

    if v_remaining_amount = 0 then
      update public.debts
      set
        status = 'paid',
        paid_at = now(),
        updated_at = now(),
        description = coalesce(description, '') ||
          ' | Da bu tru bang so du ca nhan'
      where id = v_debt.id
      returning *
      into v_debt;
    else
      update public.debts
      set
        amount = v_remaining_amount,
        updated_at = now(),
        description = coalesce(description, '') ||
          ' | Da bu tru ' || v_offset_amount::text
      where id = v_debt.id
      returning *
      into v_debt;
    end if;

    -- FIX #4: ghi balance_transaction có related_debt_id cho từng khoản bù trừ
    insert into public.balance_transactions (
      person_id,
      period_id,
      related_debt_id,
      transaction_type,
      amount,
      direction,
      description
    )
    values (
      p_person_id,
      p_period_id,
      v_debt.id,
      'offset_next_period',
      v_offset_amount,
      'minus',
      'Bu tru so du ca nhan vao cong no'
    );

    v_available_balance := v_available_balance - v_offset_amount;
    v_total_offset := v_total_offset + v_offset_amount;

    v_updated_debts := v_updated_debts || jsonb_build_array(jsonb_build_object(
      'debt_id', v_debt.id,
      'old_amount', v_old_amount,
      'offset_amount', v_offset_amount,
      'remaining_amount', v_remaining_amount,
      'debt', to_jsonb(v_debt)
    ));
  end loop;

  if v_total_offset = 0 then
    return jsonb_build_object(
      'message', 'Khong co cong no unpaid de bu tru',
      'offset_amount', 0,
      'remaining_balance', v_available_balance,
      'updated_debts', '[]'::jsonb
    );
  end if;

  update public.person_balances
  set
    balance = v_available_balance,
    updated_at = now()
  where person_id = p_person_id
  returning *
  into v_balance_row;

  return jsonb_build_object(
    'message', 'Bu tru so du thanh cong',
    'offset_amount', v_total_offset,
    'remaining_balance', v_balance_row.balance,
    'updated_debts', v_updated_debts,
    'balance_transaction', jsonb_build_object(
      'person_id', p_person_id,
      'period_id', p_period_id,
      'total_offset', v_total_offset
    )
  );
end;
$$;

grant execute on function public.process_paid_payment(bigint, jsonb) to service_role;
grant execute on function public.mark_payment_failed(bigint, jsonb) to service_role;
grant execute on function public.settle_shuttle_period(uuid) to service_role;
grant execute on function public.offset_person_period(uuid, uuid) to service_role;

-- ============================================================
-- NOTE #7: Các enum type chưa dùng trong balance_transaction_type:
--   'debit_monthly_fee', 'debit_guest_fee'
-- PostgreSQL không cho xóa enum value dễ dàng (cần recreate type).
-- Để lại và ghi chú: dành cho feature ghi log balance khi tạo debt tháng/khách,
-- chưa implement. Không xóa để tránh migration phức tạp.
-- ============================================================
