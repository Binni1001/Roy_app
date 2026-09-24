-- Stage 1B / 2A: admin-maintained manual levels and soft pair preferences only.
-- Apply AFTER 20260923_session_planning_preferences.sql, as one complete script.
-- No sessions, bookings, debts, payments or existing business rows are changed.
begin;

do $$ begin
  if to_regclass('public.session_planning_preferences') is null then
    raise exception 'Apply session_planning_preferences migration first';
  end if;
end $$;

create table if not exists public.session_planning_profiles (
  period_id uuid not null references public.periods(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  level smallint check (level between 1 and 3), -- null means unknown, not beginner
  preferred_partner_id uuid references public.people(id) on delete restrict,
  revision integer not null check (revision > 0),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (period_id, person_id),
  check (preferred_partner_id is null or preferred_partner_id <> person_id)
);

create table if not exists public.session_planning_profile_audits (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null,
  person_id uuid not null,
  revision integer not null,
  actor_id uuid not null,
  before_value jsonb,
  after_value jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (period_id, person_id) references public.session_planning_profiles(period_id, person_id) on delete restrict,
  unique (period_id, person_id, revision)
);

alter table public.session_planning_profiles enable row level security;
alter table public.session_planning_profile_audits enable row level security;
revoke all on public.session_planning_profiles, public.session_planning_profile_audits from public, anon, authenticated, service_role;
grant select on public.session_planning_profiles, public.session_planning_profile_audits to service_role;

create or replace function public.save_session_planning_profile(
  p_period_id uuid, p_person_id uuid, p_actor_id uuid, p_expected_revision integer,
  p_level smallint, p_preferred_partner_id uuid
)
returns setof public.session_planning_profiles
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_actor auth.users%rowtype;
  v_period public.periods%rowtype;
  v_person public.people%rowtype;
  v_target uuid;
  v_current public.session_planning_profiles%rowtype;
  v_saved public.session_planning_profiles%rowtype;
  v_role text;
begin
  select * into v_actor from auth.users where id = p_actor_id for share;
  if not found then raise exception using errcode = '42501', message = 'PLANNING_FORBIDDEN'; end if;
  v_role := coalesce(v_actor.raw_app_meta_data->>'role', 'user');
  if v_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'PLANNING_MANAGER_REQUIRED';
  end if;
  perform 1 from public.people where lower(trim(email)) = lower(trim(v_actor.email)) for share;
  if exists (select 1 from public.people where lower(trim(email)) = lower(trim(v_actor.email)) and status::text is distinct from 'active') then
    raise exception using errcode = '42501', message = 'PLANNING_ACTOR_INACTIVE';
  end if;
  select * into v_period from public.periods where id = p_period_id for share;
  if not found or v_period.group_id is null then
    raise exception using errcode = '42501', message = 'PLANNING_FORBIDDEN';
  end if;
  if v_role = 'admin' and not coalesce(
    jsonb_typeof(v_actor.raw_app_meta_data->'managed_group_ids') = 'array'
    and (v_actor.raw_app_meta_data->'managed_group_ids') ? v_period.group_id::text, false
  ) then
    raise exception using errcode = '42501', message = 'PLANNING_FORBIDDEN';
  end if;
  if not coalesce(v_period.status::text in ('draft', 'open'), false)
    or v_period.start_date is null or v_period.end_date is null or v_period.end_date < v_period.start_date then
    raise exception using errcode = '22023', message = 'PLANNING_PERIOD_CLOSED';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 2147483647
    or p_person_id is null or (p_level is not null and p_level not between 1 and 3)
    or p_preferred_partner_id = p_person_id then
    raise exception using errcode = '22023', message = 'PLANNING_INVALID_PROFILE';
  end if;

  -- Both sides must currently be eligible fixed players in this period and club.
  -- The choice is soft and directional; saving A's preference never edits B's profile.
  for v_target in select distinct id from unnest(array[p_person_id, p_preferred_partner_id]) as id
    where id is not null order by id loop
    select * into v_person from public.people where id = v_target for share;
    if not found or v_person.status::text is distinct from 'active' then
      raise exception using errcode = '42501', message = 'PLANNING_PERSON_UNAVAILABLE';
    end if;
    perform 1 from auth.users where lower(trim(email)) = lower(trim(v_person.email)) for share;
    if exists (select 1 from auth.users where lower(trim(email)) = lower(trim(v_person.email))
      and raw_app_meta_data->>'role' in ('owner', 'admin')) then
      raise exception using errcode = '42501', message = 'PLANNING_MANAGER_NOT_PLAYER';
    end if;
    perform 1 from public.person_groups where person_id = v_target and group_id = v_period.group_id
      and status::text = 'active' and member_role = 'member' for share;
    if not found then raise exception using errcode = '42501', message = 'PLANNING_MEMBERSHIP_REQUIRED'; end if;
    perform 1 from public.period_members where period_id = p_period_id and person_id = v_target
      and status::text = 'fixed' for share;
    if not found then raise exception using errcode = '42501', message = 'PLANNING_FIXED_MEMBER_REQUIRED'; end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended('planning-profile:' || p_period_id::text || ':' || p_person_id::text, 0));
  select * into v_current from public.session_planning_profiles
    where period_id = p_period_id and person_id = p_person_id for update;
  if coalesce(v_current.revision, 0) <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PLANNING_REVISION_CONFLICT';
  end if;
  insert into public.session_planning_profiles(period_id, person_id, level, preferred_partner_id, revision, updated_by)
  values (p_period_id, p_person_id, p_level, p_preferred_partner_id, p_expected_revision + 1, p_actor_id)
  on conflict (period_id, person_id) do update set
    level = excluded.level, preferred_partner_id = excluded.preferred_partner_id,
    revision = excluded.revision, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_saved;
  insert into public.session_planning_profile_audits(period_id, person_id, revision, actor_id, before_value, after_value)
  values (p_period_id, p_person_id, v_saved.revision, p_actor_id,
    case when v_current.revision is null then null else to_jsonb(v_current) end, to_jsonb(v_saved));
  return next v_saved;
end;
$$;

revoke all on function public.save_session_planning_profile(uuid, uuid, uuid, integer, smallint, uuid) from public, anon, authenticated;
grant execute on function public.save_session_planning_profile(uuid, uuid, uuid, integer, smallint, uuid) to service_role;
notify pgrst, 'reload schema';
commit;
