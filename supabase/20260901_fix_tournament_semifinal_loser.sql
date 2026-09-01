-- Keep the current match's loser intact while replaying completed sibling branches.
-- Without a separate variable, completing semifinal 2 reused semifinal 1's loser
-- and attempted to put the same team in both third-place slots.
create or replace function public.save_tournament_match(
  p_match_id uuid,
  p_status text,
  p_set_scores jsonb,
  p_team1_id uuid,
  p_team2_id uuid,
  p_scheduled_at timestamptz default null,
  p_court text default null,
  p_note text default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_score jsonb;
  v_team1_score integer;
  v_team2_score integer;
  v_team1_sets integer := 0;
  v_team2_sets integer := 0;
  v_needed integer;
  v_winner uuid;
  v_loser uuid;
  v_source_loser uuid;
  v_old_winner uuid;
  v_descendants uuid[] := '{}';
  v_source record;
begin
  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;
  if not found then raise exception 'Không tìm thấy trận đấu'; end if;

  select * into v_tournament
  from public.tournaments
  where id = v_match.tournament_id
  for update;

  if p_status not in ('pending', 'active', 'completed', 'cancelled') then
    raise exception 'Trạng thái trận đấu không hợp lệ';
  end if;
  if p_team1_id is not null and not exists (
    select 1 from public.tournament_teams
    where id = p_team1_id and tournament_id = v_match.tournament_id
  ) then raise exception 'Đội thứ nhất không thuộc giải'; end if;
  if p_team2_id is not null and not exists (
    select 1 from public.tournament_teams
    where id = p_team2_id and tournament_id = v_match.tournament_id
  ) then raise exception 'Đội thứ hai không thuộc giải'; end if;
  if p_team1_id is not null and p_team1_id = p_team2_id then
    raise exception 'Một đội không thể đấu với chính mình';
  end if;

  v_old_winner := v_match.winner_team_id;
  if p_status = 'completed' then
    if p_team1_id is null or p_team2_id is null then
      raise exception 'Trận đấu chưa đủ hai đội';
    end if;
    if p_set_scores is null or jsonb_typeof(p_set_scores) <> 'array'
       or jsonb_array_length(p_set_scores) = 0
       or jsonb_array_length(p_set_scores) > v_tournament.best_of then
      raise exception 'Tỷ số các hiệp không hợp lệ';
    end if;

    for v_score in select value from jsonb_array_elements(p_set_scores)
    loop
      v_team1_score := (v_score ->> 'team1')::integer;
      v_team2_score := (v_score ->> 'team2')::integer;
      if v_team1_score < 0 or v_team2_score < 0 or v_team1_score = v_team2_score then
        raise exception 'Mỗi hiệp phải có một đội thắng';
      end if;
      if v_team1_score > v_team2_score then
        v_team1_sets := v_team1_sets + 1;
      else
        v_team2_sets := v_team2_sets + 1;
      end if;
    end loop;

    v_needed := (v_tournament.best_of / 2) + 1;
    if v_team1_sets = v_needed and v_team2_sets < v_needed then
      v_winner := p_team1_id;
      v_loser := p_team2_id;
    elsif v_team2_sets = v_needed and v_team1_sets < v_needed then
      v_winner := p_team2_id;
      v_loser := p_team1_id;
    else
      raise exception 'Tỷ số chưa xác định được đội thắng';
    end if;
  else
    p_set_scores := '[]'::jsonb;
    v_winner := null;
    v_loser := null;
  end if;

  insert into public.tournament_audits(tournament_id, match_id, action, actor_email, snapshot)
  values (
    v_match.tournament_id,
    v_match.id,
    case when v_match.status = 'completed' then 'match_corrected' else 'match_updated' end,
    p_actor_email,
    jsonb_build_object('before', to_jsonb(v_match), 'set_scores', p_set_scores, 'status', p_status)
  );

  if v_match.stage <> 'group' and (
    v_old_winner is distinct from v_winner
    or v_match.team1_id is distinct from p_team1_id
    or v_match.team2_id is distinct from p_team2_id
  ) then
    with recursive branch(id) as (
      select target.id
      from public.tournament_matches source
      cross join lateral (
        values (source.next_match_id), (source.loser_next_match_id)
      ) as target(id)
      where source.id = v_match.id and target.id is not null
      union
      select target.id
      from branch
      join public.tournament_matches child on child.id = branch.id
      cross join lateral (
        values (child.next_match_id), (child.loser_next_match_id)
      ) as target(id)
      where target.id is not null
    )
    select coalesce(array_agg(distinct id), '{}') into v_descendants from branch;

    update public.tournament_matches
    set
      team1_id = case when team1_source is not null then null else team1_id end,
      team2_id = case when team2_source is not null then null else team2_id end,
      status = 'pending',
      set_scores = '[]'::jsonb,
      team1_sets = 0,
      team2_sets = 0,
      winner_team_id = null,
      completed_at = null
    where id = any(v_descendants);

    for v_source in
      select * from public.tournament_matches
      where tournament_id = v_match.tournament_id
        and id <> v_match.id
        and status in ('completed', 'bye')
        and winner_team_id is not null
        and (
          next_match_id = any(v_descendants)
          or loser_next_match_id = any(v_descendants)
        )
    loop
      if v_source.next_match_id is not null and v_source.next_match_id = any(v_descendants) then
        if v_source.next_slot = 1 then
          update public.tournament_matches set team1_id = v_source.winner_team_id where id = v_source.next_match_id;
        else
          update public.tournament_matches set team2_id = v_source.winner_team_id where id = v_source.next_match_id;
        end if;
      end if;
      if v_source.loser_next_match_id is not null and v_source.loser_next_match_id = any(v_descendants) then
        if v_source.winner_team_id = v_source.team1_id then
          v_source_loser := v_source.team2_id;
        else
          v_source_loser := v_source.team1_id;
        end if;
        if v_source.loser_next_slot = 1 then
          update public.tournament_matches set team1_id = v_source_loser where id = v_source.loser_next_match_id;
        else
          update public.tournament_matches set team2_id = v_source_loser where id = v_source.loser_next_match_id;
        end if;
      end if;
    end loop;
  end if;

  update public.tournament_matches
  set
    team1_id = p_team1_id,
    team2_id = p_team2_id,
    status = p_status,
    set_scores = coalesce(p_set_scores, '[]'::jsonb),
    team1_sets = v_team1_sets,
    team2_sets = v_team2_sets,
    winner_team_id = v_winner,
    scheduled_at = p_scheduled_at,
    court = nullif(trim(coalesce(p_court, '')), ''),
    note = nullif(trim(coalesce(p_note, '')), ''),
    completed_at = case when p_status = 'completed' then now() else null end
  where id = p_match_id;

  if v_match.stage <> 'group' and v_winner is not null then
    if v_match.next_match_id is not null then
      if v_match.next_slot = 1 then
        update public.tournament_matches set team1_id = v_winner where id = v_match.next_match_id;
      else
        update public.tournament_matches set team2_id = v_winner where id = v_match.next_match_id;
      end if;
    end if;
    if v_match.loser_next_match_id is not null then
      if v_match.loser_next_slot = 1 then
        update public.tournament_matches set team1_id = v_loser where id = v_match.loser_next_match_id;
      else
        update public.tournament_matches set team2_id = v_loser where id = v_match.loser_next_match_id;
      end if;
    end if;
  end if;

  if v_match.stage = 'final' then
    update public.tournaments
    set
      champion_team_id = v_winner,
      status = case when v_winner is not null then 'completed' else 'knockout' end
    where id = v_match.tournament_id;
  elsif v_tournament.status = 'draft' then
    update public.tournaments set status = 'group_stage' where id = v_match.tournament_id;
  end if;

  return jsonb_build_object(
    'message', case when p_status = 'completed' then 'Đã lưu kết quả trận đấu' else 'Đã cập nhật trận đấu' end,
    'match_id', p_match_id,
    'winner_team_id', v_winner
  );
end;
$$;

revoke execute on function public.save_tournament_match(uuid, text, jsonb, uuid, uuid, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_tournament_match(uuid, text, jsonb, uuid, uuid, timestamptz, text, text, text)
  to service_role;
