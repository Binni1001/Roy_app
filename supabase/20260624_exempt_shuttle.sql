-- Thêm cột miễn tiền cầu cho period_members
alter table public.period_members
  add column if not exists exempt_shuttle boolean not null default false;

-- Cập nhật RPC settle_shuttle_period: chỉ chia tiền cho fixed members KHÔNG được miễn
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
  v_new_balance numeric;
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

  -- Chỉ đếm fixed members KHÔNG được miễn tiền cầu
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

  -- Chỉ xử lý fixed members KHÔNG được miễn
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
        'Tien cau phai dong them cuoi ky'
      );
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'person_id', v_item.person_id,
      'action', case when v_item.net_amount > 0 then 'credited' else 'debited' end,
      'amount', abs(v_item.net_amount),
      'new_balance', v_new_balance
    ));
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
