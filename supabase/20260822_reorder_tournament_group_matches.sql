-- Reorder round-robin matches inside one tournament group without touching
-- teams, scores, winners, schedules or knockout data.
create or replace function public.reorder_tournament_group_matches(
  p_tournament_id uuid,
  p_group_id uuid,
  p_match_ids jsonb,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_received_count integer;
  v_distinct_count integer;
begin
  if coalesce(jsonb_typeof(p_match_ids), '') <> 'array' then
    raise exception 'Danh sách trận phải là một mảng';
  end if;

  if not exists (
    select 1 from public.tournament_groups
    where id = p_group_id and tournament_id = p_tournament_id
  ) then
    raise exception 'Không tìm thấy bảng đấu trong giải';
  end if;

  perform 1
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and group_id = p_group_id
    and stage = 'group'
  for update;

  select count(*)
  into v_expected_count
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and group_id = p_group_id
    and stage = 'group';

  select count(*), count(distinct value)
  into v_received_count, v_distinct_count
  from jsonb_array_elements_text(p_match_ids);

  if v_received_count <> v_expected_count or v_distinct_count <> v_expected_count then
    raise exception 'Danh sách trận không đầy đủ hoặc có trận bị lặp';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_match_ids) item(value)
    left join public.tournament_matches tm on tm.id = item.value::uuid
      and tm.tournament_id = p_tournament_id
      and tm.group_id = p_group_id
      and tm.stage = 'group'
    where tm.id is null
  ) then
    raise exception 'Có trận không thuộc bảng đã chọn';
  end if;

  with requested_order as (
    select value::uuid as match_id, ordinality::integer as position
    from jsonb_array_elements_text(p_match_ids) with ordinality
  )
  update public.tournament_matches tm
  set
    bracket_position = requested_order.position,
    updated_at = now()
  from requested_order
  where tm.id = requested_order.match_id;

  insert into public.tournament_audits(tournament_id, action, actor_email, snapshot)
  values (
    p_tournament_id,
    'group_matches_reordered',
    p_actor_email,
    jsonb_build_object('group_id', p_group_id, 'match_ids', p_match_ids)
  );

  return jsonb_build_object(
    'tournament_id', p_tournament_id,
    'group_id', p_group_id,
    'match_ids', p_match_ids
  );
end;
$$;

revoke execute on function public.reorder_tournament_group_matches(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.reorder_tournament_group_matches(uuid, uuid, jsonb, text)
  to service_role;
