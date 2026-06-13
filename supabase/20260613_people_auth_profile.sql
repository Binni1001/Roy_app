alter table public.people
  add column if not exists attendance_type text not null default 'guest';

alter table public.people
  drop constraint if exists people_attendance_type_check;

alter table public.people
  add constraint people_attendance_type_check
  check (attendance_type in ('fixed', 'guest'));

create unique index if not exists people_email_unique_not_null
  on public.people (lower(email))
  where email is not null;
