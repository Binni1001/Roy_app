-- Gom cong no cua mot nguoi qua nhieu ky trong cung nhom vao mot thanh toan.
-- Khi tra no cua ky da chot, tien duoc ghi vao ky dang mo cua dung nhom.
-- Khoan thu duoc chong ghi trung bang debt_id.

-- Gan cac ky cu bi thieu group_id khi co the xac dinh duy nhat tu thanh vien.
update public.periods p
set group_id = inferred.group_id
from (
  select
    pm.period_id,
    min(coalesce(pe.active_group_id, pe.group_id)::text)::uuid as group_id
  from public.period_members pm
  join public.people pe on pe.id = pm.person_id
  where coalesce(pe.active_group_id, pe.group_id) is not null
  group by pm.period_id
  having count(distinct coalesce(pe.active_group_id, pe.group_id)) = 1
) inferred
where p.id = inferred.period_id
  and p.group_id is null;

-- Du an chi co mot nhom thi cac ky con lai chac chan thuoc nhom do.
do $$
declare
  v_group_id uuid;
begin
  if (select count(*) from public.groups) = 1 then
    select id into v_group_id from public.groups limit 1;
    update public.periods set group_id = v_group_id where group_id is null;
  end if;
end;
$$;

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
  v_group_id uuid;
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

  select p.group_id
  into v_group_id
  from public.payment_debts pd
  join public.debts d on d.id = pd.debt_id
  join public.periods p on p.id = d.period_id
  where pd.payment_id = v_payment.id
  limit 1;

  select id
  into v_open_period
  from public.periods
  where status = 'open'
    and group_id is not distinct from v_group_id
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
    returning * into v_debt;

    v_updated_debts := v_updated_debts || jsonb_build_array(to_jsonb(v_debt));

    if v_debt.description is not null and v_debt.description <> '' then
      v_description := 'Thu tien - ' || v_debt.description;
    else
      v_description := 'Thu tien ' || v_debt.debt_type::text;
    end if;

    select status::text
    into v_debt_period_status
    from public.periods
    where id = v_debt.period_id;

    if v_debt_period_status = 'open' or v_open_period is null then
      v_target_period := v_debt.period_id;
    else
      v_target_period := v_open_period;
    end if;

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
        v_target_period,
        v_debt.person_id,
        v_payment.id,
        v_debt.id,
        'income',
        v_debt.amount,
        v_description
      )
      returning * into v_fund;
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
  returning * into v_payment;

  return jsonb_build_object(
    'message', 'PayOS webhook processed',
    'payment', to_jsonb(v_payment),
    'updated_debts', v_updated_debts,
    'fund_transactions', v_fund_transactions
  );
end;
$$;

grant execute on function public.process_paid_payment(bigint, jsonb) to service_role;
