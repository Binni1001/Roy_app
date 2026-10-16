-- PUBLIC DEMO migration: identifiers and seeds below are synthetic.
-- Existing deployments: DO NOT rerun already-applied migrations. See docs/PUBLIC_SOURCE.md.
-- Apply once before deploying this version. No historical Elo ledger is rebuilt.
begin;

do $$
begin
  if not exists(select 1 from public.periods where id = '373a7ed1-0e18-502d-9120-225b2f3c2179'
    and group_id = '0e25f393-ae0c-5761-9737-43a7dcaef67a' and start_date = '2026-10-10' and status in ('open','draft')) then
    raise exception 'Khong tim thay dung ky Mua 5 de ap dung luat moi'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pk-rating:373a7ed1-0e18-502d-9120-225b2f3c2179',0));
  if exists(select 1 from public.pk_matches where period_id = '373a7ed1-0e18-502d-9120-225b2f3c2179') then
    raise exception 'Mua 5 da co tran. Dung lai de doi soat, khong tu doi luat'; end if;
end;
$$;

alter table public.periods add column pk_scoring_rule text not null default 'elo_v1'
  check (pk_scoring_rule in ('elo_v1','legacy_wilson_v1','fixed_3_2_v1'));
update public.periods set pk_scoring_rule = 'legacy_wilson_v1' where id = '34ac4b6a-675c-585c-84c0-ab24ba69f50c';
update public.periods set pk_scoring_rule = 'fixed_3_2_v1' where id = '373a7ed1-0e18-502d-9120-225b2f3c2179';

create table public.pk_leaderboard_snapshots (
  period_id uuid not null references public.periods(id) on delete restrict,
  match_type text not null check(match_type in ('singles','doubles')),
  scoring_rule text not null,
  result jsonb not null,
  source_signature text,
  saved_at timestamptz not null default now(),
  primary key(period_id,match_type)
);
alter table public.pk_leaderboard_snapshots enable row level security;
revoke all on public.pk_leaderboard_snapshots from anon, authenticated;
grant select, insert on public.pk_leaderboard_snapshots to service_role;

create or replace function public.pk_ranking_source_signature(p_period_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce(string_agg(jsonb_build_array(id,match_number,played_at,match_type,status,challenger_id,challenger_partner_id,
    opponent_id,opponent_partner_id,winner_side,set_scores,voided_at)::text, E'\n' order by id),''))
  from public.pk_matches where period_id = p_period_id;
$$;

-- Historical snapshots are inserted below, after verifying their Elo source rows.
do $$ begin if coalesce((select jsonb_agg(jsonb_build_object('person_id',person_id,'match_type',match_type,'rating',rating,'matches',matches,'wins',wins,'losses',losses,'opponent_ids',opponent_ids) order by person_id,match_type) from public.pk_season_ratings where period_id='34ac4b6a-675c-585c-84c0-ab24ba69f50c'),'[]'::jsonb) <> $expected$[]$expected$::jsonb then raise exception 'Historical Elo changed since demo backup'; end if; end; $$;
insert into public.pk_leaderboard_snapshots(period_id,match_type,scoring_rule,result,source_signature) values('34ac4b6a-675c-585c-84c0-ab24ba69f50c','singles','legacy_wilson_v1',$snapshot${"period_id": "34ac4b6a-675c-585c-84c0-ab24ba69f50c", "match_type": "singles", "ranked": [{"id": "11111111-1111-4111-8111-111111111111", "full_name": "Demo Player 1", "nickname": null, "avatar_url": null, "wins": 1, "losses": 0, "total_matches": 1, "rank": 1, "points": 3, "tier_key": "champion"}, {"id": "22222222-2222-4222-8222-222222222222", "full_name": "Demo Player 2", "nickname": null, "avatar_url": null, "wins": 0, "losses": 1, "total_matches": 1, "rank": 2, "points": 0, "tier_key": "bronze"}], "qualifying": [], "archived": true, "scoring_rule": "legacy_wilson_v1", "scoring_method": "legacy_wilson", "requirements": {"min_matches": 0, "min_opponents": 0}}$snapshot$::jsonb,public.pk_ranking_source_signature('34ac4b6a-675c-585c-84c0-ab24ba69f50c'));
insert into public.pk_leaderboard_snapshots(period_id,match_type,scoring_rule,result,source_signature) values('34ac4b6a-675c-585c-84c0-ab24ba69f50c','doubles','legacy_wilson_v1',$snapshot${"period_id": "34ac4b6a-675c-585c-84c0-ab24ba69f50c", "match_type": "doubles", "ranked": [], "qualifying": [], "archived": true, "scoring_rule": "legacy_wilson_v1", "scoring_method": "legacy_wilson", "requirements": {"min_matches": 0, "min_opponents": 0}}$snapshot$::jsonb,public.pk_ranking_source_signature('34ac4b6a-675c-585c-84c0-ab24ba69f50c'));
do $$ begin if coalesce((select jsonb_agg(jsonb_build_object('person_id',person_id,'match_type',match_type,'rating',rating,'matches',matches,'wins',wins,'losses',losses,'opponent_ids',opponent_ids) order by person_id,match_type) from public.pk_season_ratings where period_id='7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'),'[]'::jsonb) <> $expected$[{"person_id": "11111111-1111-4111-8111-111111111111", "match_type": "singles", "rating": 1020, "matches": 1, "wins": 1, "losses": 0, "opponent_ids": ["22222222-2222-4222-8222-222222222222"]}, {"person_id": "22222222-2222-4222-8222-222222222222", "match_type": "singles", "rating": 980, "matches": 1, "wins": 0, "losses": 1, "opponent_ids": ["11111111-1111-4111-8111-111111111111"]}]$expected$::jsonb then raise exception 'Historical Elo changed since demo backup'; end if; end; $$;
insert into public.pk_leaderboard_snapshots(period_id,match_type,scoring_rule,result,source_signature) values('7ee421b7-1ec9-54de-8a82-ea9a31ba72fa','singles','elo_v1',$snapshot${"period_id": "7ee421b7-1ec9-54de-8a82-ea9a31ba72fa", "match_type": "singles", "ranked": [{"id": "11111111-1111-4111-8111-111111111111", "full_name": "Demo Player 1", "nickname": null, "avatar_url": null, "wins": 1, "losses": 0, "total_matches": 1, "rank": 1, "points": 3, "tier_key": "champion"}, {"id": "22222222-2222-4222-8222-222222222222", "full_name": "Demo Player 2", "nickname": null, "avatar_url": null, "wins": 0, "losses": 1, "total_matches": 1, "rank": 2, "points": 0, "tier_key": "bronze"}], "qualifying": [], "archived": true, "scoring_rule": "elo_v1", "scoring_method": "elo", "requirements": {"min_matches": 0, "min_opponents": 0}}$snapshot$::jsonb,public.pk_ranking_source_signature('7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'));
insert into public.pk_leaderboard_snapshots(period_id,match_type,scoring_rule,result,source_signature) values('7ee421b7-1ec9-54de-8a82-ea9a31ba72fa','doubles','elo_v1',$snapshot${"period_id": "7ee421b7-1ec9-54de-8a82-ea9a31ba72fa", "match_type": "doubles", "ranked": [], "qualifying": [], "archived": true, "scoring_rule": "elo_v1", "scoring_method": "elo", "requirements": {"min_matches": 0, "min_opponents": 0}}$snapshot$::jsonb,public.pk_ranking_source_signature('7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'));

-- Copy the actual installed functions instead of changing the historical formula.
do $$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('public.pk_apply_completed_match(uuid)'::regprocedure);
  execute replace(v_definition, 'FUNCTION public.pk_apply_completed_match(', 'FUNCTION public.pk_apply_completed_match_elo_v1(');
  v_definition := pg_get_functiondef('public.rebuild_pk_season_elo(uuid)'::regprocedure);
  execute replace(v_definition, 'FUNCTION public.rebuild_pk_season_elo(', 'FUNCTION public.rebuild_pk_season_elo_v1(');
end;
$$;

create or replace function public.pk_apply_completed_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rule text; v_status text;
begin
  select p.pk_scoring_rule,p.status::text into v_rule,v_status from public.pk_matches m
    join public.periods p on p.id=m.period_id where m.id=p_match_id;
  if not found then raise exception 'PK match does not exist'; end if;
  if v_status = 'closed' then raise exception 'Ky da dong, giu nguyen lich su dau truong'; end if;
  if v_rule = 'elo_v1' then perform public.pk_apply_completed_match_elo_v1(p_match_id);
  elsif v_rule = 'fixed_3_2_v1' then
    -- Points and rally differential are derived from the locked match results.
    -- No Elo row is written for this rule.
    return;
  else raise exception 'Ky lich su Wilson da duoc khoa'; end if;
end;
$$;

create or replace function public.rebuild_pk_season_elo(p_period_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rule text; v_status text;
begin
  select pk_scoring_rule,status::text into v_rule,v_status from public.periods where id=p_period_id;
  if not found then raise exception 'Period ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || p_period_id::text,0));
  if v_status = 'closed' then raise exception 'Ky da dong, giu nguyen lich su dau truong'; end if;
  if v_rule = 'elo_v1' then return public.rebuild_pk_season_elo_v1(p_period_id);
  elsif v_rule = 'fixed_3_2_v1' then
    return jsonb_build_object('period_id',p_period_id,'scoring_rule',v_rule,'processed_matches',
      (select count(*) from public.pk_matches where period_id=p_period_id and status='completed' and voided_at is null));
  else raise exception 'Ky lich su Wilson da duoc khoa'; end if;
end;
$$;

create or replace function public.guard_pk_scoring_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_period uuid; v_rule text; v_status text; v_score jsonb;
begin
  if TG_OP='DELETE' then v_period:=OLD.period_id; else v_period:=NEW.period_id; end if;
  if TG_OP='UPDATE' and NEW.period_id is distinct from OLD.period_id then
    raise exception 'Khong duoc chuyen tran dau sang ky khac'; end if;
  if v_period is null then raise exception 'Tran dau phai thuoc mot ky'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || v_period::text,0));
  select pk_scoring_rule,status::text into v_rule,v_status from public.periods where id=v_period for update;
  if v_status <> 'open' then raise exception 'Ky chua mo hoac da dong, khong the thay doi tran dau'; end if;
  if v_rule='fixed_3_2_v1' and TG_OP <> 'DELETE' and NEW.status='completed' then
    if NEW.set_scores is null or jsonb_typeof(NEW.set_scores)<>'array' or jsonb_array_length(NEW.set_scores)=0 then
      raise exception 'Tran hoan tat can ty so set de tinh hieu so'; end if;
    for v_score in select value from jsonb_array_elements(NEW.set_scores) loop
      if jsonb_typeof(v_score->'challenger') is distinct from 'number'
        or jsonb_typeof(v_score->'opponent') is distinct from 'number' then raise exception 'Ty so phai la so nguyen'; end if;
      if (v_score->>'challenger')::numeric <> trunc((v_score->>'challenger')::numeric)
        or (v_score->>'opponent')::numeric <> trunc((v_score->>'opponent')::numeric)
        or (v_score->>'challenger')::numeric < 0 or (v_score->>'opponent')::numeric < 0
        or (v_score->>'challenger')::numeric = (v_score->>'opponent')::numeric then
        raise exception 'Ty so set khong hop le'; end if;
    end loop;
  end if;
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
end;
$$;
create trigger aaa_pk_scoring_rule_guard before insert or update or delete on public.pk_matches
for each row execute function public.guard_pk_scoring_period();

create or replace function public.guard_pk_period_rule()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP='INSERT' then
    if NEW.group_id='0e25f393-ae0c-5761-9737-43a7dcaef67a' and NEW.start_date >= '2026-10-10' then
      NEW.pk_scoring_rule:='fixed_3_2_v1'; end if;
  else
    if OLD.status='closed' and NEW.status<>'closed' then raise exception 'Ky lich su da dong khong the mo lai'; end if;
    if NEW.pk_scoring_rule is distinct from OLD.pk_scoring_rule
      and (OLD.status='closed' or exists(select 1 from public.pk_matches where period_id=OLD.id)) then
      raise exception 'Luat dau truong cua ky da co tran hoac da dong khong the doi'; end if;
    if NEW.status='closed' and OLD.status<>'closed'
      and (select count(*) from public.pk_leaderboard_snapshots where period_id=NEW.id) <> 2 then
      raise exception 'Can luu ca bang don va doi khi dong ky'; end if;
  end if;
  return NEW;
end;
$$;
create trigger pk_period_rule_guard before insert or update on public.periods
for each row execute function public.guard_pk_period_rule();

create or replace function public.guard_pk_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
begin raise exception 'Bang lich su da luu khong the sua/xoa'; end;
$$;
create trigger pk_snapshot_immutable before update or delete on public.pk_leaderboard_snapshots
for each row execute function public.guard_pk_snapshot();

-- The backend computes both tables using the period's own rule. A source signature
-- checked under the match write lock prevents archiving a stale table during close.
create or replace function public.close_period_with_pk_history(p_period_id uuid,p_patch jsonb,
  p_expected_signature text,p_boards jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_period public.periods%rowtype; v_patch public.periods%rowtype; v_type text; v_board jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || p_period_id::text,0));
  select * into v_period from public.periods where id=p_period_id for update;
  if not found then raise exception 'Ky khong ton tai'; end if;
  if v_period.status='closed' then return to_jsonb(v_period); end if;
  if public.pk_ranking_source_signature(p_period_id) is distinct from p_expected_signature then
    raise exception 'Ket qua tran vua thay doi. Tai lai bang truoc khi dong ky'; end if;
  foreach v_type in array array['singles','doubles'] loop
    v_board:=p_boards->v_type;
    if v_board is null or v_board->>'period_id' is distinct from p_period_id::text
      or v_board->>'match_type' is distinct from v_type
      or v_board->>'scoring_rule' is distinct from v_period.pk_scoring_rule
      or jsonb_typeof(v_board->'ranked') is distinct from 'array' then raise exception 'Bang lich su khong hop le'; end if;
    insert into public.pk_leaderboard_snapshots(period_id,match_type,scoring_rule,result,source_signature)
      values(p_period_id,v_type,v_period.pk_scoring_rule,v_board || jsonb_build_object('archived',true),p_expected_signature);
  end loop;
  v_patch:=jsonb_populate_record(v_period,p_patch);
  update public.periods set name=v_patch.name,start_date=v_patch.start_date,end_date=v_patch.end_date,
    fixed_member_fee=v_patch.fixed_member_fee,guest_fee_per_session=v_patch.guest_fee_per_session,
    note=v_patch.note,status='closed',updated_at=now() where id=p_period_id returning * into v_period;
  return to_jsonb(v_period);
end;
$$;

revoke all on function public.pk_apply_completed_match_elo_v1(uuid),public.rebuild_pk_season_elo_v1(uuid),
  public.pk_apply_completed_match(uuid),public.rebuild_pk_season_elo(uuid),public.pk_ranking_source_signature(uuid),
  public.close_period_with_pk_history(uuid,jsonb,text,jsonb),public.guard_pk_scoring_period(),public.guard_pk_period_rule(),public.guard_pk_snapshot()
  from public,anon,authenticated;
grant execute on function public.pk_apply_completed_match(uuid),public.rebuild_pk_season_elo(uuid),
  public.pk_ranking_source_signature(uuid),public.close_period_with_pk_history(uuid,jsonb,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
