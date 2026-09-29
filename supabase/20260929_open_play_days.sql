-- Run in Supabase SQL Editor. Independent of availability/draft planning migrations.
-- Registration only: does not create attendance, debts or payments.
begin;
create table if not exists public.open_play_days (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  play_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  capacity integer not null default 8 check (capacity = 8),
  note text not null default '' check (length(note) <= 300),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  unique (period_id, play_date)
);
create table if not exists public.open_play_registrations (
  day_id uuid not null references public.open_play_days(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (day_id, person_id)
);
alter table public.open_play_days enable row level security;
alter table public.open_play_registrations enable row level security;
revoke all on public.open_play_days, public.open_play_registrations from public, anon, authenticated, service_role;
grant select on public.open_play_days, public.open_play_registrations to service_role;

create or replace function public.mutate_open_play_day(
  p_period_id uuid, p_play_date date, p_actor_id uuid, p_action text, p_note text default ''
) returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_actor auth.users%rowtype;
  v_period public.periods%rowtype;
  v_person public.people%rowtype;
  v_day public.open_play_days%rowtype;
  v_role text;
begin
  select * into v_actor from auth.users where id = p_actor_id for share;
  if not found then raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN'; end if;
  v_role := coalesce(v_actor.raw_app_meta_data->>'role', 'user');
  if v_role not in ('owner', 'admin', 'user') then v_role := 'user'; end if;
  perform 1 from public.people where lower(email) = lower(v_actor.email) for share;
  if exists (select 1 from public.people where lower(email) = lower(v_actor.email) and status::text is distinct from 'active') then
    raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN';
  end if;
  select * into v_period from public.periods where id = p_period_id for share;
  if not found or v_period.group_id is null then raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN'; end if;
  if v_role = 'admin' and not coalesce(jsonb_typeof(v_actor.raw_app_meta_data->'managed_group_ids') = 'array'
    and (v_actor.raw_app_meta_data->'managed_group_ids') ? v_period.group_id::text, false) then
    raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN';
  end if;
  if p_action is null or p_action not in ('open', 'close', 'reopen', 'join', 'leave')
    or p_play_date is null or v_period.status::text is distinct from 'open'
    or v_period.start_date is null or v_period.end_date is null
    or p_play_date not between v_period.start_date and v_period.end_date
    or p_note is null or length(p_note) > 300 then
    raise exception using errcode='22023', message='OPEN_DAY_UNAVAILABLE';
  end if;
  if p_action in ('open', 'close', 'reopen') then
    if v_role not in ('owner', 'admin') then raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN'; end if;
  else
    -- Identity is derived from trusted Auth, never a browser-provided person ID.
    if v_role <> 'user' or v_actor.email is null then raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN'; end if;
    select * into strict v_person from public.people where lower(email) = lower(v_actor.email) and status::text = 'active' for share;
    perform 1 from public.person_groups where person_id = v_person.id and group_id = v_period.group_id
      and status::text = 'active' and member_role = 'member' for share;
    if not found then raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN'; end if;
  end if;
  -- Lock even a missing day, so creation and every registration/closure serialize.
  perform pg_advisory_xact_lock(hashtextextended('open-play:' || p_period_id::text || ':' || p_play_date::text, 0));
  if clock_timestamp() >= ((p_play_date + time '17:30') at time zone 'Asia/Ho_Chi_Minh') then
    raise exception using errcode='22023', message='OPEN_DAY_UNAVAILABLE';
  end if;
  if p_action = 'open' then
    insert into public.open_play_days(period_id, play_date, note, created_by)
    values (p_period_id, p_play_date, p_note, p_actor_id) on conflict (period_id, play_date) do nothing;
    return;
  end if;
  select * into v_day from public.open_play_days where period_id = p_period_id and play_date = p_play_date for update;
  if not found then raise exception using errcode='22023', message='OPEN_DAY_UNAVAILABLE'; end if;
  if p_action in ('close', 'reopen') then
    update public.open_play_days set status = case when p_action = 'close' then 'closed' else 'open' end,
      updated_at = now() where id = v_day.id;
  elsif p_action = 'leave' then
    -- Closing registration retains the roster; existing players can still cancel before start.
    delete from public.open_play_registrations where day_id = v_day.id and person_id = v_person.id;
  else
    if v_day.status <> 'open' then raise exception using errcode='22023', message='OPEN_DAY_UNAVAILABLE'; end if;
    if exists (select 1 from public.open_play_registrations where day_id = v_day.id and person_id = v_person.id) then return; end if;
    if (select count(*) from public.open_play_registrations where day_id = v_day.id) >= v_day.capacity then
      raise exception using errcode='P0001', message='OPEN_DAY_FULL';
    end if;
    insert into public.open_play_registrations(day_id, person_id) values (v_day.id, v_person.id);
  end if;
exception when no_data_found or too_many_rows then
  raise exception using errcode='42501', message='OPEN_DAY_FORBIDDEN';
end;
$$;
revoke all on function public.mutate_open_play_day(uuid, date, uuid, text, text) from public, anon, authenticated;
grant execute on function public.mutate_open_play_day(uuid, date, uuid, text, text) to service_role;
notify pgrst, 'reload schema';
commit;
