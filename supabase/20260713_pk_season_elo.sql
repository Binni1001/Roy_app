-- Seasonal Elo ledger for PK matches.
-- Backfills only period 7ee421b7-1ec9-54de-8a82-ea9a31ba72fa (July 2026).

begin;

drop view if exists public.pk_leaderboard;

alter table public.pk_matches
  add column if not exists match_number integer,
  add column if not exists completed_at timestamptz,
  add column if not exists rating_locked_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_email text,
  add column if not exists void_reason text;

alter table public.pk_matches
  drop constraint if exists pk_matches_match_number_positive;

alter table public.pk_matches
  add constraint pk_matches_match_number_positive
  check (match_number is null or match_number > 0);

create unique index if not exists pk_matches_period_match_number_unique
  on public.pk_matches(period_id, match_number)
  where match_number is not null;

create index if not exists pk_matches_period_status_number_idx
  on public.pk_matches(period_id, status, match_number);

create table if not exists public.pk_season_ratings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  match_type text not null check (match_type in ('singles', 'doubles')),
  rating numeric(12, 4) not null default 1000,
  matches integer not null default 0 check (matches >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  opponent_ids uuid[] not null default '{}'::uuid[],
  last_match_number integer,
  updated_at timestamptz not null default now(),
  unique(period_id, person_id, match_type)
);

create index if not exists pk_season_ratings_leaderboard_idx
  on public.pk_season_ratings(period_id, match_type, rating desc);

create table if not exists public.pk_rating_events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  match_id uuid not null references public.pk_matches(id) on delete restrict,
  match_number integer not null,
  match_type text not null check (match_type in ('singles', 'doubles')),
  person_id uuid not null references public.people(id) on delete restrict,
  side text not null check (side in ('challenger', 'opponent')),
  result smallint not null check (result in (0, 1)),
  rating_before numeric(12, 4) not null,
  opponent_rating numeric(12, 4) not null,
  expected_score numeric(12, 8) not null,
  k_factor integer not null check (k_factor in (24, 40)),
  rating_delta numeric(12, 4) not null,
  rating_after numeric(12, 4) not null,
  opponent_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  unique(match_id, person_id)
);

create index if not exists pk_rating_events_period_number_idx
  on public.pk_rating_events(period_id, match_number, person_id);

create table if not exists public.pk_match_audits (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pk_matches(id) on delete restrict,
  action text not null check (action in ('finalized', 'voided')),
  actor_email text,
  reason text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pk_match_audits_match_idx
  on public.pk_match_audits(match_id, created_at desc);

alter table public.pk_season_ratings enable row level security;
alter table public.pk_rating_events enable row level security;
alter table public.pk_match_audits enable row level security;

create or replace function public.pk_assign_match_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.period_id is null then
    raise exception 'PK match must belong to a period';
  end if;

  if new.status = 'completed' then
    raise exception 'Create the match first, then finalize it';
  end if;

  if new.match_number is null then
    perform pg_advisory_xact_lock(hashtextextended('pk-match:' || new.period_id::text, 0));

    select coalesce(max(m.match_number), 0) + 1
      into new.match_number
    from public.pk_matches m
    where m.period_id = new.period_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pk_assign_match_number on public.pk_matches;
create trigger trg_pk_assign_match_number
before insert on public.pk_matches
for each row execute function public.pk_assign_match_number();

create or replace function public.pk_apply_completed_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.pk_matches%rowtype;
  v_challengers uuid[];
  v_opponents uuid[];
  v_team_challenger numeric(12, 4);
  v_team_opponent numeric(12, 4);
  v_expected_challenger numeric(12, 8);
  v_expected_opponent numeric(12, 8);
  v_side integer;
  v_people uuid[];
  v_opposing_people uuid[];
  v_person_id uuid;
  v_result smallint;
  v_side_name text;
  v_expected numeric(12, 8);
  v_opponent_rating numeric(12, 4);
  v_rating_before numeric(12, 4);
  v_rating_after numeric(12, 4);
  v_delta numeric(12, 4);
  v_matches integer;
  v_wins integer;
  v_losses integer;
  v_k integer;
  v_existing_opponents uuid[];
  v_all_opponents uuid[];
begin
  select * into v_match
  from public.pk_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'PK match does not exist';
  end if;

  if v_match.status <> 'completed'
     or v_match.winner_side is null
     or v_match.period_id is null
     or v_match.match_number is null
     or v_match.voided_at is not null then
    raise exception 'PK match is not eligible for Elo';
  end if;

  if exists (select 1 from public.pk_rating_events where match_id = p_match_id) then
    return;
  end if;

  v_challengers := array[v_match.challenger_id];
  v_opponents := array[v_match.opponent_id];

  if v_match.match_type = 'doubles' then
    if v_match.challenger_partner_id is null or v_match.opponent_partner_id is null then
      raise exception 'A doubles match requires four players';
    end if;
    v_challengers := v_challengers || v_match.challenger_partner_id;
    v_opponents := v_opponents || v_match.opponent_partner_id;
  end if;

  select avg(coalesce(r.rating, 1000))
    into v_team_challenger
  from unnest(v_challengers) as p(person_id)
  left join public.pk_season_ratings r
    on r.period_id = v_match.period_id
   and r.person_id = p.person_id
   and r.match_type = v_match.match_type;

  select avg(coalesce(r.rating, 1000))
    into v_team_opponent
  from unnest(v_opponents) as p(person_id)
  left join public.pk_season_ratings r
    on r.period_id = v_match.period_id
   and r.person_id = p.person_id
   and r.match_type = v_match.match_type;

  v_expected_challenger := (
    1.0 / (1.0 + power(10.0, ((v_team_opponent - v_team_challenger) / 400.0)::double precision))
  )::numeric;
  v_expected_opponent := 1.0 - v_expected_challenger;

  for v_side in 1..2 loop
    if v_side = 1 then
      v_people := v_challengers;
      v_opposing_people := v_opponents;
      v_result := case when v_match.winner_side = 'challenger' then 1 else 0 end;
      v_side_name := 'challenger';
      v_expected := v_expected_challenger;
      v_opponent_rating := v_team_opponent;
    else
      v_people := v_opponents;
      v_opposing_people := v_challengers;
      v_result := case when v_match.winner_side = 'opponent' then 1 else 0 end;
      v_side_name := 'opponent';
      v_expected := v_expected_opponent;
      v_opponent_rating := v_team_challenger;
    end if;

    foreach v_person_id in array v_people loop
      select rating, matches, wins, losses, opponent_ids
        into v_rating_before, v_matches, v_wins, v_losses, v_existing_opponents
      from public.pk_season_ratings
      where period_id = v_match.period_id
        and person_id = v_person_id
        and match_type = v_match.match_type;

      if not found then
        v_rating_before := 1000;
        v_matches := 0;
        v_wins := 0;
        v_losses := 0;
        v_existing_opponents := '{}'::uuid[];
      end if;

      v_k := case when v_matches < 5 then 40 else 24 end;
      v_delta := round((v_k * (v_result - v_expected))::numeric, 4);
      v_rating_after := round(v_rating_before + v_delta, 4);

      select coalesce(array_agg(distinct opponent_id), '{}'::uuid[])
        into v_all_opponents
      from unnest(coalesce(v_existing_opponents, '{}'::uuid[]) || v_opposing_people)
        as opponents(opponent_id);

      insert into public.pk_rating_events (
        period_id, match_id, match_number, match_type, person_id, side, result,
        rating_before, opponent_rating, expected_score, k_factor,
        rating_delta, rating_after, opponent_ids
      ) values (
        v_match.period_id, v_match.id, v_match.match_number, v_match.match_type,
        v_person_id, v_side_name, v_result, v_rating_before, v_opponent_rating,
        v_expected, v_k, v_delta, v_rating_after, v_opposing_people
      );

      insert into public.pk_season_ratings (
        period_id, person_id, match_type, rating, matches, wins, losses,
        opponent_ids, last_match_number, updated_at
      ) values (
        v_match.period_id, v_person_id, v_match.match_type, v_rating_after,
        v_matches + 1,
        v_wins + case when v_result = 1 then 1 else 0 end,
        v_losses + case when v_result = 0 then 1 else 0 end,
        v_all_opponents, v_match.match_number, now()
      )
      on conflict (period_id, person_id, match_type) do update set
        rating = excluded.rating,
        matches = excluded.matches,
        wins = excluded.wins,
        losses = excluded.losses,
        opponent_ids = excluded.opponent_ids,
        last_match_number = excluded.last_match_number,
        updated_at = excluded.updated_at;
    end loop;
  end loop;
end;
$$;

create or replace function public.rebuild_pk_season_elo(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_count integer := 0;
begin
  if p_period_id is null then
    raise exception 'Period ID is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || p_period_id::text, 0));

  delete from public.pk_rating_events where period_id = p_period_id;
  delete from public.pk_season_ratings where period_id = p_period_id;

  for v_match in
    select id
    from public.pk_matches
    where period_id = p_period_id
      and status = 'completed'
      and winner_side is not null
      and voided_at is null
    order by match_number, created_at, id
  loop
    perform public.pk_apply_completed_match(v_match.id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'period_id', p_period_id,
    'processed_matches', v_count
  );
end;
$$;

-- Assign stable numbers to all 18 existing July matches, including cancelled ones.
with ordered_matches as (
  select
    id,
    row_number() over (order by created_at, id)::integer as next_number
  from public.pk_matches
  where period_id = '7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'::uuid
)
update public.pk_matches m
set match_number = ordered_matches.next_number
from ordered_matches
where m.id = ordered_matches.id
  and m.match_number is null;

update public.pk_matches
set
  completed_at = coalesce(completed_at, updated_at, created_at, now()),
  rating_locked_at = coalesce(rating_locked_at, updated_at, created_at, now())
where period_id = '7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'::uuid
  and status = 'completed'
  and winner_side is not null;

select public.rebuild_pk_season_elo('7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'::uuid);

create or replace function public.pk_guard_locked_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.rating_locked_at is not null then
      raise exception 'A completed PK match cannot be deleted';
    end if;
    return old;
  end if;

  if old.rating_locked_at is not null and (
    new.period_id is distinct from old.period_id
    or new.match_number is distinct from old.match_number
    or new.match_type is distinct from old.match_type
    or new.challenger_id is distinct from old.challenger_id
    or new.challenger_partner_id is distinct from old.challenger_partner_id
    or new.opponent_id is distinct from old.opponent_id
    or new.opponent_partner_id is distinct from old.opponent_partner_id
    or new.played_at is distinct from old.played_at
    or new.sets is distinct from old.sets
    or new.set_scores is distinct from old.set_scores
    or new.winner_side is distinct from old.winner_side
    or new.status is distinct from old.status
  ) then
    raise exception 'A completed PK match is locked';
  end if;

  if old.status <> 'completed'
     and new.status = 'completed'
     and coalesce(current_setting('app.pk_finalize', true), 'off') <> 'on' then
    raise exception 'Use finalize_pk_match to complete a PK match';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pk_guard_locked_match on public.pk_matches;
create trigger trg_pk_guard_locked_match
before update or delete on public.pk_matches
for each row execute function public.pk_guard_locked_match();

create or replace function public.finalize_pk_match(
  p_match_id uuid,
  p_winner_side text,
  p_set_scores jsonb,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.pk_matches%rowtype;
  v_score jsonb;
  v_challenger_score integer;
  v_opponent_score integer;
  v_challenger_sets integer := 0;
  v_opponent_sets integer := 0;
begin
  select * into v_match
  from public.pk_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'PK match does not exist';
  end if;

  if v_match.status = 'completed' or v_match.rating_locked_at is not null then
    raise exception 'PK match is already completed and locked';
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'A cancelled PK match cannot be completed';
  end if;

  if p_winner_side not in ('challenger', 'opponent') then
    raise exception 'Winner side is invalid';
  end if;

  if p_set_scores is null
     or jsonb_typeof(p_set_scores) <> 'array'
     or jsonb_array_length(p_set_scores) = 0 then
    raise exception 'Set scores are required before completing the match';
  end if;

  if jsonb_array_length(p_set_scores) > coalesce(v_match.sets, 1) then
    raise exception 'Set score count exceeds the configured match sets';
  end if;

  for v_score in select value from jsonb_array_elements(p_set_scores)
  loop
    if jsonb_typeof(v_score) <> 'object'
       or not (v_score ? 'challenger')
       or not (v_score ? 'opponent') then
      raise exception 'Set score format is invalid';
    end if;

    v_challenger_score := (v_score ->> 'challenger')::integer;
    v_opponent_score := (v_score ->> 'opponent')::integer;

    if v_challenger_score < 0
       or v_opponent_score < 0
       or v_challenger_score = v_opponent_score then
      raise exception 'Each set must have one winner';
    end if;

    if v_challenger_score > v_opponent_score then
      v_challenger_sets := v_challenger_sets + 1;
    else
      v_opponent_sets := v_opponent_sets + 1;
    end if;
  end loop;

  if (p_winner_side = 'challenger' and v_challenger_sets <= v_opponent_sets)
     or (p_winner_side = 'opponent' and v_opponent_sets <= v_challenger_sets) then
    raise exception 'Winner side does not match the set scores';
  end if;

  if exists (
    select 1
    from public.pk_matches previous_match
    where previous_match.period_id = v_match.period_id
      and previous_match.match_number < v_match.match_number
      and previous_match.status in ('pending', 'active')
  ) then
    raise exception 'Complete or cancel earlier PK matches first';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || v_match.period_id::text, 0));
  perform set_config('app.pk_finalize', 'on', true);

  update public.pk_matches
  set
    status = 'completed',
    winner_side = p_winner_side,
    set_scores = p_set_scores,
    completed_at = now(),
    rating_locked_at = now(),
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  perform public.pk_apply_completed_match(p_match_id);

  insert into public.pk_match_audits(match_id, action, actor_email, snapshot)
  values (p_match_id, 'finalized', p_actor_email, to_jsonb(v_match));

  return jsonb_build_object(
    'message', 'PK match finalized',
    'match', to_jsonb(v_match)
  );
end;
$$;

create or replace function public.void_pk_match(
  p_match_id uuid,
  p_reason text,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.pk_matches%rowtype;
  v_rebuild jsonb;
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'A void reason of at least 5 characters is required';
  end if;

  select * into v_match
  from public.pk_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'PK match does not exist';
  end if;

  if v_match.status <> 'completed' or v_match.rating_locked_at is null then
    raise exception 'Only a completed PK match can be voided';
  end if;

  if v_match.voided_at is not null then
    raise exception 'PK match has already been voided';
  end if;

  update public.pk_matches
  set
    voided_at = now(),
    voided_by_email = p_actor_email,
    void_reason = trim(p_reason),
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  insert into public.pk_match_audits(match_id, action, actor_email, reason, snapshot)
  values (p_match_id, 'voided', p_actor_email, trim(p_reason), to_jsonb(v_match));

  v_rebuild := public.rebuild_pk_season_elo(v_match.period_id);

  return jsonb_build_object(
    'message', 'PK match voided and season Elo rebuilt',
    'match', to_jsonb(v_match),
    'rebuild', v_rebuild
  );
end;
$$;

drop policy if exists "Authenticated users read PK matches" on public.pk_matches;
create policy "Authenticated users read PK matches"
on public.pk_matches
for select
to authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pk_matches'
  ) then
    alter publication supabase_realtime add table public.pk_matches;
  end if;
end;
$$;

revoke all on table public.pk_season_ratings from anon, authenticated;
revoke all on table public.pk_rating_events from anon, authenticated;
revoke all on table public.pk_match_audits from anon, authenticated;

revoke execute on function public.pk_apply_completed_match(uuid) from public, anon, authenticated;
revoke execute on function public.rebuild_pk_season_elo(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_pk_match(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.void_pk_match(uuid, text, text) from public, anon, authenticated;

grant execute on function public.finalize_pk_match(uuid, text, jsonb, text) to service_role;
grant execute on function public.void_pk_match(uuid, text, text) to service_role;
grant execute on function public.rebuild_pk_season_elo(uuid) to service_role;
grant select, insert, update, delete on public.pk_season_ratings to service_role;
grant select, insert, update, delete on public.pk_rating_events to service_role;
grant select, insert, update, delete on public.pk_match_audits to service_role;

commit;
