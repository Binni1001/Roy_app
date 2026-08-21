-- Roy Badminton doubles tournament module.
-- This data is intentionally independent from PK matches and seasonal Elo.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'group_stage', 'knockout', 'completed', 'cancelled')),
  group_count integer not null default 2 check (group_count between 1 and 4),
  qualifiers_per_group integer not null default 2 check (qualifiers_per_group = 2),
  knockout_start text not null default 'semifinal'
    check (knockout_start in ('quarterfinal', 'semifinal', 'final')),
  best_of smallint not null default 3 check (best_of in (1, 3, 5)),
  points_for_win smallint not null default 3 check (points_for_win = 3),
  third_place_enabled boolean not null default false,
  start_date date,
  end_date date,
  champion_team_id uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  seed integer check (seed is null or seed > 0),
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tournament_id)
);

alter table public.tournaments
  drop constraint if exists tournaments_champion_team_id_fkey;
alter table public.tournaments
  add constraint tournaments_champion_team_id_fkey
  foreign key (champion_team_id) references public.tournament_teams(id) on delete set null;

create unique index if not exists tournament_team_seed_unique
  on public.tournament_teams(tournament_id, seed)
  where seed is not null;

create table if not exists public.tournament_team_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null,
  person_id uuid not null references public.people(id) on delete restrict,
  member_slot smallint not null check (member_slot in (1, 2)),
  created_at timestamptz not null default now(),
  foreign key (team_id, tournament_id)
    references public.tournament_teams(id, tournament_id) on delete cascade,
  unique (team_id, member_slot),
  unique (tournament_id, person_id)
);

create table if not exists public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 8),
  name text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (id, tournament_id),
  unique (tournament_id, code),
  unique (tournament_id, position)
);

create table if not exists public.tournament_group_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id uuid not null,
  team_id uuid not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  primary key (group_id, team_id),
  foreign key (group_id, tournament_id)
    references public.tournament_groups(id, tournament_id) on delete cascade,
  foreign key (team_id, tournament_id)
    references public.tournament_teams(id, tournament_id) on delete cascade,
  unique (tournament_id, team_id),
  unique (group_id, position)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_id uuid references public.tournament_groups(id) on delete cascade,
  stage text not null
    check (stage in ('group', 'quarterfinal', 'semifinal', 'final', 'third_place')),
  bracket_key text,
  bracket_position integer not null default 1 check (bracket_position > 0),
  match_number integer not null check (match_number > 0),
  team1_id uuid references public.tournament_teams(id) on delete set null,
  team2_id uuid references public.tournament_teams(id) on delete set null,
  team1_source text,
  team2_source text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'cancelled', 'bye')),
  set_scores jsonb not null default '[]'::jsonb,
  team1_sets smallint not null default 0 check (team1_sets >= 0),
  team2_sets smallint not null default 0 check (team2_sets >= 0),
  winner_team_id uuid references public.tournament_teams(id) on delete set null,
  next_match_id uuid references public.tournament_matches(id) on delete set null,
  next_slot smallint check (next_slot in (1, 2)),
  loser_next_match_id uuid references public.tournament_matches(id) on delete set null,
  loser_next_slot smallint check (loser_next_slot in (1, 2)),
  scheduled_at timestamptz,
  court text,
  note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, match_number),
  unique (tournament_id, bracket_key),
  check (team1_id is null or team2_id is null or team1_id <> team2_id),
  check (jsonb_typeof(set_scores) = 'array')
);

create table if not exists public.tournament_audits (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid references public.tournament_matches(id) on delete set null,
  action text not null,
  actor_email text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tournaments_group_status_idx
  on public.tournaments(group_id, status, created_at desc);
create index if not exists tournament_matches_stage_idx
  on public.tournament_matches(tournament_id, stage, bracket_position);
create index if not exists tournament_matches_schedule_idx
  on public.tournament_matches(tournament_id, scheduled_at);
create index if not exists tournament_audits_tournament_idx
  on public.tournament_audits(tournament_id, created_at desc);

create or replace function public.touch_tournament_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tournaments_updated_at on public.tournaments;
create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row execute function public.touch_tournament_updated_at();

drop trigger if exists trg_tournament_teams_updated_at on public.tournament_teams;
create trigger trg_tournament_teams_updated_at
before update on public.tournament_teams
for each row execute function public.touch_tournament_updated_at();

drop trigger if exists trg_tournament_matches_updated_at on public.tournament_matches;
create trigger trg_tournament_matches_updated_at
before update on public.tournament_matches
for each row execute function public.touch_tournament_updated_at();

create or replace function public.configure_doubles_tournament(
  p_tournament_id uuid,
  p_teams jsonb,
  p_group_count integer,
  p_knockout_start text,
  p_best_of integer,
  p_third_place_enabled boolean,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_team jsonb;
  v_members jsonb;
  v_member_id uuid;
  v_team_id uuid;
  v_group_id uuid;
  v_group_index integer;
  v_group record;
  v_team1 record;
  v_team2 record;
  v_team_count integer;
  v_member_count integer;
  v_match_number integer := 0;
  v_group_match_number integer;
  v_slot integer;
  v_seed integer;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Không tìm thấy giải đấu';
  end if;
  if p_group_count not between 1 and 4 then
    raise exception 'Số bảng phải nằm trong khoảng từ 1 đến 4';
  end if;
  if p_knockout_start not in ('quarterfinal', 'semifinal', 'final') then
    raise exception 'Vòng bắt đầu loại trực tiếp không hợp lệ';
  end if;
  if p_best_of not in (1, 3, 5) then
    raise exception 'Số hiệp phải là 1, 3 hoặc 5';
  end if;
  if p_teams is null or jsonb_typeof(p_teams) <> 'array' then
    raise exception 'Danh sách đội không hợp lệ';
  end if;

  v_team_count := jsonb_array_length(p_teams);
  if v_team_count < p_group_count * 2 then
    raise exception 'Mỗi bảng cần ít nhất hai đội';
  end if;

  select count(*), count(distinct member.value)
  into v_member_count, v_slot
  from jsonb_array_elements(p_teams) team(value)
  cross join lateral jsonb_array_elements_text(team.value -> 'member_ids') member(value);

  if v_member_count <> v_team_count * 2 or v_slot <> v_member_count then
    raise exception 'Mỗi người chỉ được tham gia một đội và mỗi đội phải có hai người';
  end if;

  insert into public.tournament_audits(tournament_id, action, actor_email, snapshot)
  values (
    p_tournament_id,
    'structure_reconfigured',
    p_actor_email,
    jsonb_build_object(
      'before', to_jsonb(v_tournament),
      'team_count', v_team_count,
      'group_count', p_group_count
    )
  );

  delete from public.tournament_matches where tournament_id = p_tournament_id;
  delete from public.tournament_groups where tournament_id = p_tournament_id;
  delete from public.tournament_teams where tournament_id = p_tournament_id;

  for v_group_index in 1..p_group_count loop
    insert into public.tournament_groups(tournament_id, code, name, position)
    values (
      p_tournament_id,
      chr(64 + v_group_index),
      'Bảng ' || chr(64 + v_group_index),
      v_group_index
    );
  end loop;

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    v_members := v_team -> 'member_ids';
    if jsonb_typeof(v_members) <> 'array' or jsonb_array_length(v_members) <> 2 then
      raise exception 'Mỗi đội phải có đúng hai thành viên';
    end if;

    v_group_index := nullif(v_team ->> 'group_index', '')::integer;
    if v_group_index is null or v_group_index not between 1 and p_group_count then
      raise exception 'Mỗi đội phải được xếp vào một bảng hợp lệ';
    end if;

    select id into v_group_id
    from public.tournament_groups
    where tournament_id = p_tournament_id and position = v_group_index;

    v_seed := nullif(v_team ->> 'seed', '')::integer;
    insert into public.tournament_teams(tournament_id, name, seed)
    values (
      p_tournament_id,
      trim(coalesce(nullif(v_team ->> 'name', ''), 'Đội chưa đặt tên')),
      v_seed
    )
    returning id into v_team_id;

    v_slot := 0;
    for v_member_id in
      select value::uuid from jsonb_array_elements_text(v_members)
    loop
      v_slot := v_slot + 1;
      if not exists (
        select 1
        from public.people person
        where person.id = v_member_id
          and person.status = 'active'
          and (
            person.group_id = v_tournament.group_id
            or person.active_group_id = v_tournament.group_id
            or exists (
              select 1 from public.person_groups membership
              where membership.person_id = person.id
                and membership.group_id = v_tournament.group_id
                and membership.status = 'active'
            )
          )
      ) then
        raise exception 'Thành viên không hoạt động trong nhóm của giải';
      end if;

      insert into public.tournament_team_members(
        tournament_id, team_id, person_id, member_slot
      ) values (
        p_tournament_id, v_team_id, v_member_id, v_slot
      );
    end loop;

    select coalesce(max(position), 0) + 1 into v_slot
    from public.tournament_group_teams
    where group_id = v_group_id;

    insert into public.tournament_group_teams(
      tournament_id, group_id, team_id, position
    ) values (
      p_tournament_id, v_group_id, v_team_id, v_slot
    );
  end loop;

  for v_group in
    select id, position from public.tournament_groups
    where tournament_id = p_tournament_id
    order by position
  loop
    v_group_match_number := 0;
    for v_team1 in
      select team_id, position from public.tournament_group_teams
      where group_id = v_group.id
      order by position
    loop
      for v_team2 in
        select team_id, position from public.tournament_group_teams
        where group_id = v_group.id and position > v_team1.position
        order by position
      loop
        v_match_number := v_match_number + 1;
        v_group_match_number := v_group_match_number + 1;
        insert into public.tournament_matches(
          tournament_id, group_id, stage, bracket_position, match_number,
          team1_id, team2_id, team1_source, team2_source
        ) values (
          p_tournament_id, v_group.id, 'group', v_group_match_number, v_match_number,
          v_team1.team_id, v_team2.team_id,
          'Bảng ' || chr(64 + v_group.position),
          'Bảng ' || chr(64 + v_group.position)
        );
      end loop;
    end loop;
  end loop;

  update public.tournaments
  set
    group_count = p_group_count,
    knockout_start = p_knockout_start,
    best_of = p_best_of,
    third_place_enabled = coalesce(p_third_place_enabled, false),
    status = 'draft',
    champion_team_id = null
  where id = p_tournament_id;

  return jsonb_build_object(
    'message', 'Đã dựng lại vòng bảng',
    'team_count', v_team_count,
    'group_count', p_group_count,
    'group_match_count', v_match_number
  );
end;
$$;

create or replace function public.replace_tournament_knockout(
  p_tournament_id uuid,
  p_matches jsonb,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_match jsonb;
  v_match_id uuid;
  v_next_id uuid;
  v_loser_next_id uuid;
  v_created integer := 0;
  v_changed integer;
  v_source record;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then raise exception 'Không tìm thấy giải đấu'; end if;
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'Cấu trúc vòng trong không hợp lệ';
  end if;

  insert into public.tournament_audits(tournament_id, action, actor_email, snapshot)
  values (
    p_tournament_id,
    'knockout_rebuilt',
    p_actor_email,
    jsonb_build_object('previous_status', v_tournament.status, 'matches', p_matches)
  );

  delete from public.tournament_matches
  where tournament_id = p_tournament_id and stage <> 'group';

  for v_match in select value from jsonb_array_elements(p_matches)
  loop
    insert into public.tournament_matches(
      tournament_id, stage, bracket_key, bracket_position, match_number,
      team1_id, team2_id, team1_source, team2_source, status
    ) values (
      p_tournament_id,
      v_match ->> 'stage',
      v_match ->> 'key',
      (v_match ->> 'position')::integer,
      (v_match ->> 'match_number')::integer,
      nullif(v_match ->> 'team1_id', '')::uuid,
      nullif(v_match ->> 'team2_id', '')::uuid,
      nullif(v_match ->> 'team1_source', ''),
      nullif(v_match ->> 'team2_source', ''),
      case
        when (
          (nullif(v_match ->> 'team1_id', '') is not null and nullif(v_match ->> 'team2_id', '') is null and nullif(v_match ->> 'team2_source', '') is null)
          or
          (nullif(v_match ->> 'team2_id', '') is not null and nullif(v_match ->> 'team1_id', '') is null and nullif(v_match ->> 'team1_source', '') is null)
        ) then 'bye'
        else 'pending'
      end
    )
    returning id into v_match_id;
    v_created := v_created + 1;
  end loop;

  for v_match in select value from jsonb_array_elements(p_matches)
  loop
    select id into v_match_id
    from public.tournament_matches
    where tournament_id = p_tournament_id and bracket_key = v_match ->> 'key';

    v_next_id := null;
    v_loser_next_id := null;
    if nullif(v_match ->> 'next_key', '') is not null then
      select id into v_next_id from public.tournament_matches
      where tournament_id = p_tournament_id and bracket_key = v_match ->> 'next_key';
    end if;
    if nullif(v_match ->> 'loser_next_key', '') is not null then
      select id into v_loser_next_id from public.tournament_matches
      where tournament_id = p_tournament_id and bracket_key = v_match ->> 'loser_next_key';
    end if;

    update public.tournament_matches
    set
      next_match_id = v_next_id,
      next_slot = nullif(v_match ->> 'next_slot', '')::smallint,
      loser_next_match_id = v_loser_next_id,
      loser_next_slot = nullif(v_match ->> 'loser_next_slot', '')::smallint
    where id = v_match_id;
  end loop;

  update public.tournament_matches
  set
    winner_team_id = coalesce(team1_id, team2_id),
    completed_at = now()
  where tournament_id = p_tournament_id and status = 'bye';

  loop
    v_changed := 0;
    for v_source in
      select * from public.tournament_matches
      where tournament_id = p_tournament_id
        and status = 'bye'
        and winner_team_id is not null
    loop
      if v_source.next_match_id is not null then
        if v_source.next_slot = 1 then
          update public.tournament_matches set team1_id = v_source.winner_team_id
          where id = v_source.next_match_id and team1_id is distinct from v_source.winner_team_id;
        else
          update public.tournament_matches set team2_id = v_source.winner_team_id
          where id = v_source.next_match_id and team2_id is distinct from v_source.winner_team_id;
        end if;
        get diagnostics v_changed = row_count;
      end if;
    end loop;
    exit when v_changed = 0;
  end loop;

  update public.tournaments
  set status = 'knockout', champion_team_id = null
  where id = p_tournament_id;

  return jsonb_build_object('message', 'Đã tạo vòng loại trực tiếp', 'match_count', v_created);
end;
$$;

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
          v_loser := v_source.team2_id;
        else
          v_loser := v_source.team1_id;
        end if;
        if v_source.loser_next_slot = 1 then
          update public.tournament_matches set team1_id = v_loser where id = v_source.loser_next_match_id;
        else
          update public.tournament_matches set team2_id = v_loser where id = v_source.loser_next_match_id;
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

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_team_members enable row level security;
alter table public.tournament_groups enable row level security;
alter table public.tournament_group_teams enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_audits enable row level security;

revoke all on table public.tournaments from anon, authenticated;
revoke all on table public.tournament_teams from anon, authenticated;
revoke all on table public.tournament_team_members from anon, authenticated;
revoke all on table public.tournament_groups from anon, authenticated;
revoke all on table public.tournament_group_teams from anon, authenticated;
revoke all on table public.tournament_matches from anon, authenticated;
revoke all on table public.tournament_audits from anon, authenticated;

grant select, insert, update, delete on table public.tournaments to service_role;
grant select, insert, update, delete on table public.tournament_teams to service_role;
grant select, insert, update, delete on table public.tournament_team_members to service_role;
grant select, insert, update, delete on table public.tournament_groups to service_role;
grant select, insert, update, delete on table public.tournament_group_teams to service_role;
grant select, insert, update, delete on table public.tournament_matches to service_role;
grant select, insert, update, delete on table public.tournament_audits to service_role;

revoke execute on function public.configure_doubles_tournament(uuid, jsonb, integer, text, integer, boolean, text)
  from public, anon, authenticated;
revoke execute on function public.replace_tournament_knockout(uuid, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.save_tournament_match(uuid, text, jsonb, uuid, uuid, timestamptz, text, text, text)
  from public, anon, authenticated;

grant execute on function public.configure_doubles_tournament(uuid, jsonb, integer, text, integer, boolean, text)
  to service_role;
grant execute on function public.replace_tournament_knockout(uuid, jsonb, text)
  to service_role;
grant execute on function public.save_tournament_match(uuid, text, jsonb, uuid, uuid, timestamptz, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
