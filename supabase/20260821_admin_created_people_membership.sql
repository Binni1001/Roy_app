-- Repair legacy people created from the admin screen before group membership
-- was written together with the people row. Automatic repair is deliberately
-- limited to databases with exactly one group to avoid assigning a person to
-- the wrong club.
do $$
declare
  v_group_id uuid;
begin
  select id
  into v_group_id
  from public.groups
  limit 1;

  if (select count(*) from public.groups) <> 1 then
    raise notice 'Skipped: the database does not contain exactly one group.';
    return;
  end if;

  update public.people p
  set
    group_id = v_group_id,
    active_group_id = case
      when p.status = 'active' then v_group_id
      else p.active_group_id
    end,
    updated_at = now()
  where not exists (
    select 1
    from public.person_groups pg
    where pg.person_id = p.id
  )
    and p.group_id is null
    and p.active_group_id is null;

  insert into public.person_groups (person_id, group_id, status, member_role)
  select
    p.id,
    v_group_id,
    p.status,
    'member'
  from public.people p
  where (p.group_id = v_group_id or p.active_group_id = v_group_id)
    and not exists (
      select 1
      from public.person_groups pg
      where pg.person_id = p.id
        and pg.group_id = v_group_id
    )
  on conflict (person_id, group_id) do nothing;
end
$$;
