-- Cho phep Admin sua nham nguoi/loai tran da hoan tat ma khong lam sai Elo.
-- Ket qua va thu tu tran duoc giu nguyen; Elo cua ca ky duoc dung lai trong cung giao dich.

alter table public.pk_match_audits
  drop constraint if exists pk_match_audits_action_check;

alter table public.pk_match_audits
  add constraint pk_match_audits_action_check
  check (action in ('finalized', 'voided', 'corrected'));

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

  if old.rating_locked_at is not null
     and coalesce(current_setting('app.pk_correction', true), 'off') <> 'on'
     and (
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

create or replace function public.correct_completed_pk_match(
  p_match_id uuid,
  p_match_type text,
  p_challenger_id uuid,
  p_opponent_id uuid,
  p_challenger_partner_id uuid default null,
  p_opponent_partner_id uuid default null,
  p_sets integer default 1,
  p_played_at timestamptz default null,
  p_bet_items text default null,
  p_note text default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.pk_matches%rowtype;
  v_updated public.pk_matches%rowtype;
  v_old_snapshot jsonb;
  v_people uuid[];
  v_rebuild jsonb;
begin
  select * into v_match
  from public.pk_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'PK match does not exist';
  end if;

  if v_match.status <> 'completed' or v_match.rating_locked_at is null then
    raise exception 'Only a completed PK match can be corrected';
  end if;

  if v_match.voided_at is not null then
    raise exception 'A voided PK match cannot be corrected';
  end if;

  if p_match_type not in ('singles', 'doubles') then
    raise exception 'Match type is invalid';
  end if;

  if p_challenger_id is null or p_opponent_id is null then
    raise exception 'Both match sides are required';
  end if;

  if p_sets not in (1, 3, 5) then
    raise exception 'Configured match sets are invalid';
  end if;

  if jsonb_array_length(coalesce(v_match.set_scores, '[]'::jsonb)) > p_sets then
    raise exception 'Set score count exceeds the configured match sets';
  end if;

  if p_match_type = 'doubles' then
    if p_challenger_partner_id is null or p_opponent_partner_id is null then
      raise exception 'A doubles match requires four players';
    end if;
    v_people := array[
      p_challenger_id,
      p_challenger_partner_id,
      p_opponent_id,
      p_opponent_partner_id
    ];
  else
    v_people := array[p_challenger_id, p_opponent_id];
    p_challenger_partner_id := null;
    p_opponent_partner_id := null;
  end if;

  if (select count(distinct person_id) from unnest(v_people) as players(person_id))
     <> cardinality(v_people) then
    raise exception 'A player cannot appear twice in the same match';
  end if;

  if exists (
    select 1
    from unnest(v_people) as players(person_id)
    left join public.people person on person.id = players.person_id
    where person.id is null or person.status <> 'active'
  ) then
    raise exception 'Every player must be active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || v_match.period_id::text, 0));
  perform set_config('app.pk_correction', 'on', true);
  v_old_snapshot := to_jsonb(v_match);

  update public.pk_matches
  set
    match_type = p_match_type,
    challenger_id = p_challenger_id,
    opponent_id = p_opponent_id,
    challenger_partner_id = p_challenger_partner_id,
    opponent_partner_id = p_opponent_partner_id,
    sets = p_sets,
    played_at = coalesce(p_played_at, played_at),
    bet_items = nullif(btrim(p_bet_items), ''),
    note = nullif(btrim(p_note), ''),
    updated_at = now()
  where id = p_match_id
  returning * into v_updated;

  insert into public.pk_match_audits(match_id, action, actor_email, snapshot)
  values (
    p_match_id,
    'corrected',
    p_actor_email,
    jsonb_build_object('before', v_old_snapshot, 'after', to_jsonb(v_updated))
  );

  v_rebuild := public.rebuild_pk_season_elo(v_match.period_id);

  return jsonb_build_object(
    'message', 'Completed PK match corrected',
    'match', to_jsonb(v_updated),
    'rebuild', v_rebuild
  );
end;
$$;

revoke execute on function public.correct_completed_pk_match(
  uuid, text, uuid, uuid, uuid, uuid, integer, timestamptz, text, text, text
) from public, anon, authenticated;

grant execute on function public.correct_completed_pk_match(
  uuid, text, uuid, uuid, uuid, uuid, integer, timestamptz, text, text, text
) to service_role;
