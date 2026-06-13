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

create or replace function public.mark_payment_failed(
  p_order_code bigint,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_payment public.payments%rowtype;
begin
  update public.payments
  set
    status = 'failed',
    raw_payload = p_raw_payload,
    updated_at = now()
  where payos_order_code = p_order_code
  returning *
  into v_payment;

  if not found then
    return jsonb_build_object(
      'test_webhook', true,
      'message', 'Payment order code does not exist',
      'order_code', p_order_code
    );
  end if;

  return jsonb_build_object(
    'message', 'Payment failed',
    'payment', to_jsonb(v_payment)
  );
end;
$$;

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
  v_balance numeric;
  v_new_balance numeric;
  v_debt public.debts%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_preview_details jsonb := '[]'::jsonb;
begin
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

  insert into public.balance_transactions (
    person_id,
    period_id,
    transaction_type,
    amount,
    direction,
    description
  )
  values (
    p_person_id,
    p_period_id,
    'offset_next_period',
    v_total_offset,
    'minus',
    'Bu tru so du ca nhan vao cong no'
  )
  returning *
  into v_transaction;

  return jsonb_build_object(
    'message', 'Bu tru so du thanh cong',
    'offset_amount', v_total_offset,
    'remaining_balance', v_balance_row.balance,
    'updated_debts', v_updated_debts,
    'balance_transaction', to_jsonb(v_transaction)
  );
end;
$$;

grant execute on function public.process_paid_payment(bigint, jsonb) to service_role;
grant execute on function public.mark_payment_failed(bigint, jsonb) to service_role;
grant execute on function public.settle_shuttle_period(uuid) to service_role;
grant execute on function public.offset_person_period(uuid, uuid) to service_role;
