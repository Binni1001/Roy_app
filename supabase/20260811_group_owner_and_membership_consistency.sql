-- Link the legacy owner account to Roy Badminton and repair memberships that
-- were activated through people.status without updating person_groups.status.
do $$
declare
  v_group_id uuid;
  v_owner_person_id uuid;
begin
  select id
  into v_group_id
  from public.groups
  where lower(invite_code) = lower('DEMO-CLUB')
  limit 1;

  if v_group_id is null then
    raise exception 'Roy Badminton group was not found';
  end if;

  select id
  into v_owner_person_id
  from public.people
  where lower(email) = lower('owner@example.test')
  limit 1;

  if v_owner_person_id is null then
    insert into public.people (
      full_name,
      email,
      status,
      attendance_type,
      group_id,
      active_group_id,
      note
    )
    values (
      'Demo Owner',
      'owner@example.test',
      'active',
      'guest',
      v_group_id,
      v_group_id,
      'Tài khoản trưởng nhóm'
    )
    returning id into v_owner_person_id;
  else
    update public.people
    set
      status = 'active',
      group_id = v_group_id,
      active_group_id = v_group_id,
      updated_at = now()
    where id = v_owner_person_id;
  end if;

  insert into public.person_groups (person_id, group_id, status, member_role)
  values (v_owner_person_id, v_group_id, 'active', 'owner')
  on conflict (person_id, group_id)
  do update set
    status = 'active',
    member_role = 'owner';

  update public.groups
  set
    created_by = v_owner_person_id,
    updated_at = now()
  where id = v_group_id;

  update public.person_groups pg
  set status = 'active'
  from public.people p
  where p.id = pg.person_id
    and p.active_group_id = pg.group_id
    and p.status = 'active'
    and pg.status = 'pending';
end
$$;
