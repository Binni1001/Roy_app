-- Apply after 20261011_pk_fixed_points.sql. Does not modify existing results.
begin;
create or replace function public.correct_pk_match_result(
  p_match_id uuid,p_winner_side text,p_set_scores jsonb,p_expected_updated_at timestamptz,
  p_actor_email text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_match public.pk_matches%rowtype; v_before jsonb; v_period uuid; v_status text;
  v_score jsonb; v_challenger integer; v_opponent integer; v_cwins integer:=0; v_owins integer:=0; v_rebuild jsonb;
begin
  select period_id into v_period from public.pk_matches where id=p_match_id;
  if not found then raise exception 'PK match does not exist'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pk-rating:' || v_period::text,0));
  select status::text into v_status from public.periods where id=v_period for update;
  if v_status <> 'open' then raise exception 'Closed period results cannot be corrected'; end if;
  select * into v_match from public.pk_matches where id=p_match_id for update;
  if v_match.status is distinct from 'completed' or v_match.rating_locked_at is null then
    raise exception 'Only a completed PK match can be corrected'; end if;
  if v_match.voided_at is not null then raise exception 'A voided PK match cannot be corrected'; end if;
  if p_expected_updated_at is null or v_match.updated_at is distinct from p_expected_updated_at then
    raise exception 'PK match changed; reload before correcting'; end if;
  if p_winner_side is null or p_winner_side not in ('challenger','opponent') then raise exception 'Winner side is invalid'; end if;
  if p_set_scores is null or jsonb_typeof(p_set_scores)<>'array' or jsonb_array_length(p_set_scores)=0 then
    raise exception 'Set scores are required'; end if;
  if jsonb_array_length(p_set_scores)>coalesce(v_match.sets,1) then raise exception 'Set score count exceeds configured sets'; end if;
  for v_score in select value from jsonb_array_elements(p_set_scores) loop
    if jsonb_typeof(v_score->'challenger') is distinct from 'number' or jsonb_typeof(v_score->'opponent') is distinct from 'number' then
      raise exception 'Set score format is invalid'; end if;
    if (v_score->>'challenger')::numeric<>trunc((v_score->>'challenger')::numeric)
      or (v_score->>'opponent')::numeric<>trunc((v_score->>'opponent')::numeric) then raise exception 'Set score format is invalid'; end if;
    v_challenger:=(v_score->>'challenger')::integer; v_opponent:=(v_score->>'opponent')::integer;
    if v_challenger<0 or v_opponent<0 or v_challenger=v_opponent then raise exception 'Each set must have one winner'; end if;
    if v_challenger>v_opponent then v_cwins:=v_cwins+1; else v_owins:=v_owins+1; end if;
  end loop;
  if (p_winner_side='challenger' and v_cwins<=v_owins) or (p_winner_side='opponent' and v_owins<=v_cwins) then
    raise exception 'Winner side does not match set scores'; end if;
  v_before:=to_jsonb(v_match);
  perform set_config('app.pk_correction','on',true);
  update public.pk_matches set winner_side=p_winner_side,set_scores=p_set_scores,updated_at=now()
    where id=p_match_id returning * into v_match;
  insert into public.pk_match_audits(match_id,action,actor_email,snapshot)
    values(p_match_id,'corrected',p_actor_email,jsonb_build_object('correction_kind','result','before',v_before,'after',to_jsonb(v_match)));
  v_rebuild:=public.rebuild_pk_season_elo(v_period);
  return jsonb_build_object('match',to_jsonb(v_match),'rebuild',v_rebuild);
end;
$$;
revoke all on function public.correct_pk_match_result(uuid,text,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.correct_pk_match_result(uuid,text,jsonb,timestamptz,text) to service_role;
notify pgrst,'reload schema';
commit;
