-- Stage 1 only: recurring availability + dated overrides. No sessions/debts are changed.
-- Run as a single transaction in Supabase SQL Editor after reviewing the runbook.
begin;

create table if not exists public.session_planning_preferences (
  period_id uuid not null references public.periods(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  busy_weekdays smallint[] not null default '{}',
  date_overrides jsonb not null default '{}',
  revision integer not null check (revision > 0),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (period_id, person_id),
  check (cardinality(busy_weekdays) <= 7 and busy_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
    and array_position(busy_weekdays, null) is null),
  check (jsonb_typeof(date_overrides) = 'object')
);

create table if not exists public.session_planning_preference_audits (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null,
  person_id uuid not null,
  revision integer not null,
  actor_id uuid not null,
  before_value jsonb,
  after_value jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (period_id, person_id) references public.session_planning_preferences(period_id, person_id) on delete restrict,
  unique (period_id, person_id, revision)
);

alter table public.session_planning_preferences enable row level security;
alter table public.session_planning_preference_audits enable row level security;
-- All access goes through the backend. No browser reads of other players' availability.
revoke all on public.session_planning_preferences, public.session_planning_preference_audits from public, anon, authenticated;
revoke all on public.session_planning_preferences, public.session_planning_preference_audits from service_role;
grant select on public.session_planning_preferences, public.session_planning_preference_audits to service_role;

create or replace function public.save_session_planning_preferences(
  p_period_id uuid,
  p_person_id uuid,
  p_actor_id uuid,
  p_expected_revision integer,
  p_busy_weekdays smallint[],
  p_date_overrides jsonb
)
returns setof public.session_planning_preferences
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_period public.periods%rowtype;
  v_actor auth.users%rowtype;
  v_person public.people%rowtype;
  v_current public.session_planning_preferences%rowtype;
  v_saved public.session_planning_preferences%rowtype;
  v_role text;
  v_key text;
  v_value jsonb;
  v_date date;
begin
  -- The service-role-only caller supplies the actor from a freshly validated JWT.
  -- Check current trusted Auth metadata again, not metadata supplied by the browser.
  select * into v_actor from auth.users where id = p_actor_id for share;
  if not found then raise exception using errcode = '42501', message = 'PLANNING_FORBIDDEN'; end if;
  v_role := coalesce(v_actor.raw_app_meta_data->>'role', 'user');
  if v_role not in ('owner', 'admin', 'user') then v_role := 'user'; end if;
  perform 1 from public.people where lower(email) = lower(v_actor.email) for share;
  if exists (select 1 from public.people where lower(email) = lower(v_actor.email) and status::text is distinct from 'active') then
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

  select * into v_person from public.people where id = p_person_id for share;
  if not found or v_person.status::text is distinct from 'active' then
    raise exception using errcode = '42501', message = 'PLANNING_PERSON_UNAVAILABLE';
  end if;
  if v_role = 'user' and (v_actor.email is null or v_person.email is null or lower(v_person.email) <> lower(v_actor.email)) then
    raise exception using errcode = '42501', message = 'PLANNING_SELF_ONLY';
  end if;
  perform 1 from auth.users where lower(email) = lower(v_person.email) for share;
  if exists (select 1 from auth.users where lower(email) = lower(v_person.email)
    and raw_app_meta_data->>'role' in ('owner', 'admin')) then
    raise exception using errcode = '42501', message = 'PLANNING_MANAGER_NOT_PLAYER';
  end if;
  perform 1 from public.person_groups where person_id = p_person_id and group_id = v_period.group_id
    and status::text = 'active' and member_role = 'member' for share;
  if not found then raise exception using errcode = '42501', message = 'PLANNING_MEMBERSHIP_REQUIRED'; end if;
  perform 1 from public.period_members where period_id = p_period_id and person_id = p_person_id
    and status::text = 'fixed' for share;
  if not found then raise exception using errcode = '42501', message = 'PLANNING_FIXED_MEMBER_REQUIRED'; end if;

  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 2147483647
    or p_busy_weekdays is null or cardinality(p_busy_weekdays) > 7
    or not (p_busy_weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
    or array_position(p_busy_weekdays, null) is not null
    or p_date_overrides is null or jsonb_typeof(p_date_overrides) <> 'object' then
    raise exception using errcode = '22023', message = 'PLANNING_INVALID_INPUT';
  end if;
  if (select count(*) from jsonb_object_keys(p_date_overrides)) > 370 then
    raise exception using errcode = '22023', message = 'PLANNING_TOO_MANY_DATES';
  end if;
  for v_key, v_value in select key, value from jsonb_each(p_date_overrides) loop
    if v_key !~ '^\d{4}-\d{2}-\d{2}$' or v_value not in ('"busy"'::jsonb, '"available"'::jsonb) then
      raise exception using errcode = '22023', message = 'PLANNING_INVALID_DATE';
    end if;
    begin
      v_date := v_key::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'PLANNING_INVALID_DATE';
    end;
    if to_char(v_date, 'YYYY-MM-DD') <> v_key or v_date < v_period.start_date or v_date > v_period.end_date then
      raise exception using errcode = '22023', message = 'PLANNING_DATE_OUTSIDE_PERIOD';
    end if;
  end loop;

  -- Serialize first insert as well as updates; FK rows alone do not lock a missing preference.
  perform pg_advisory_xact_lock(hashtextextended(p_period_id::text || ':' || p_person_id::text, 0));
  select * into v_current from public.session_planning_preferences
    where period_id = p_period_id and person_id = p_person_id for update;
  if coalesce(v_current.revision, 0) <> p_expected_revision then
    raise exception using errcode = '40001', message = 'PLANNING_REVISION_CONFLICT';
  end if;

  insert into public.session_planning_preferences(period_id, person_id, busy_weekdays, date_overrides, revision, updated_by)
  values (p_period_id, p_person_id,
    array(select distinct d from unnest(p_busy_weekdays) as d order by d),
    p_date_overrides, p_expected_revision + 1, p_actor_id)
  on conflict (period_id, person_id) do update set
    busy_weekdays = excluded.busy_weekdays, date_overrides = excluded.date_overrides,
    revision = excluded.revision, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_saved;

  insert into public.session_planning_preference_audits(period_id, person_id, revision, actor_id, before_value, after_value)
  values (p_period_id, p_person_id, v_saved.revision, p_actor_id,
    case when v_current.revision is null then null else to_jsonb(v_current) end, to_jsonb(v_saved));
  return next v_saved;
end;
$$;

revoke all on function public.save_session_planning_preferences(uuid, uuid, uuid, integer, smallint[], jsonb) from public, anon, authenticated;
grant execute on function public.save_session_planning_preferences(uuid, uuid, uuid, integer, smallint[], jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
