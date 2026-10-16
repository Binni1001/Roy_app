import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildFixedPkLeaderboard } from "../src/modules/pk-matches/pkPoints.js";

const next="373a7ed1-0e18-502d-9120-225b2f3c2179", group="0e25f393-ae0c-5761-9737-43a7dcaef67a";
const people=["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333","44444444-4444-4444-8444-444444444444"];
const backup=JSON.parse(await readFile(new URL("./fixtures/pk-history-demo.json",import.meta.url),"utf8"));
const migration=await readFile(new URL("../../supabase/20261011_pk_fixed_points.sql",import.meta.url),"utf8");
const correction=await readFile(new URL("../../supabase/20261011_pk_result_correction.sql",import.meta.url),"utf8");

async function setup() {
  const db=new PGlite();
  try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table periods(id uuid primary key,name text,status text,start_date date,end_date date,group_id uuid,
      fixed_member_fee numeric default 0,guest_fee_per_session numeric default 0,note text,updated_at timestamptz);
    create table people(id uuid primary key,full_name text,nickname text,avatar_url text,attendance_type text,status text default 'active');
    create table pk_matches(id uuid primary key default gen_random_uuid(),period_id uuid references periods,
      match_type text,status text default 'pending',challenger_id uuid references people,challenger_partner_id uuid references people,
      opponent_id uuid references people,opponent_partner_id uuid references people,winner_side text,
      sets integer default 1,set_scores jsonb,played_at timestamptz,bet_items text,note text,
      created_at timestamptz default now(),updated_at timestamptz default now());`);
  for(const entry of backup.periods) await db.query("insert into periods(id,name,status,start_date,end_date,group_id) values($1,$2,$3,$4,$5,$6)",
    [entry.period.id,entry.period.name,entry.period.status,entry.period.start_date,entry.period.end_date,entry.period.group_id]);
  await db.query("insert into periods(id,name,status,start_date,end_date,group_id) values($1,'Mùa 5','open','2026-10-10','2026-11-09',$2)",[next,group]);
  const ids=new Set(people);
  for(const entry of backup.periods) for(const row of entry.elo_ratings) ids.add(row.person_id);
  for(const id of ids) await db.query("insert into people(id,full_name) values($1,$2)",[id,`Player ${id}`]);
  let old=await readFile(new URL("../../supabase/20260713_pk_season_elo.sql",import.meta.url),"utf8");
  old=old.slice(0,old.indexOf("-- Assign stable numbers"))+old.slice(old.indexOf("create or replace function public.pk_guard_locked_match"));
  old=old.slice(0,old.indexOf("do $$\nbegin\n  if not exists (\n    select 1\n    from pg_publication_tables"))+old.slice(old.indexOf("revoke all on table public.pk_season_ratings"));
  await db.exec(old);
  await db.exec(await readFile(new URL("../../supabase/20260803_correct_completed_pk_match.sql",import.meta.url),"utf8"));
  // Import already-completed historical rows into the isolated fixture only.
  await db.exec("alter table pk_matches disable trigger trg_pk_assign_match_number");
  for(const entry of backup.periods) {
    const grouped=new Map();
    for(const event of entry.elo_events) {if(!grouped.has(event.match_id))grouped.set(event.match_id,[]);grouped.get(event.match_id).push(event);}
    for(const [id,events] of grouped) {
      const c=events.filter(e=>e.side==="challenger"),o=events.filter(e=>e.side==="opponent");
      await db.query("insert into pk_matches(id,period_id,match_type,status,match_number,challenger_id,challenger_partner_id,opponent_id,opponent_partner_id,winner_side) values($1,$2,$3,'completed',$4,$5,$6,$7,$8,$9)",
        [id,entry.period.id,events[0].match_type,events[0].match_number,c[0]?.person_id,c[1]?.person_id||null,o[0]?.person_id,o[1]?.person_id||null,c[0]?.result===1?"challenger":"opponent"]);
    }
    for(const row of entry.elo_ratings) await db.query("insert into pk_season_ratings select * from jsonb_populate_record(null::pk_season_ratings,$1)",[row]);
    for(const row of entry.elo_events) await db.query("insert into pk_rating_events select * from jsonb_populate_record(null::pk_rating_events,$1)",[row]);
  }
  await db.exec("alter table pk_matches enable trigger trg_pk_assign_match_number");
  return db;
  } catch (error) { await db.close(); throw error; }
}
async function ledger(db) {return {
  ratings:(await db.query("select * from pk_season_ratings order by id")).rows,
  events:(await db.query("select * from pk_rating_events order by id")).rows,
};}
async function makeMatch(db,period=next,type="singles") {
  return (await db.query("insert into pk_matches(period_id,match_type,challenger_id,opponent_id,challenger_partner_id,opponent_partner_id,played_at) values($1,$2,$3,$4,$5,$6,'2026-10-11') returning id",
    [period,type,people[0],people[1],type==="doubles"?people[2]:null,type==="doubles"?people[3]:null])).rows[0].id;
}
const finish=(db,id)=>db.query("select finalize_pk_match($1,'challenger',$2,'owner@example.test')",[id,[{challenger:21,opponent:19}]]);

test("upgrade preserves historical ledgers and tables; Mùa 5 uses no Elo even for finalize/correction/void",async()=>{
  const db=await setup();
  try{
    const before=await ledger(db);
    await db.exec(migration);
    assert.deepEqual(await ledger(db),before);
    for(const entry of backup.periods) for(const type of ["singles","doubles"]){
      const snapshot=(await db.query("select result from pk_leaderboard_snapshots where period_id=$1 and match_type=$2",[entry.period.id,type])).rows[0].result;
      assert.deepEqual(snapshot.ranked,entry.leaderboards[type].ranked);
      assert.deepEqual(snapshot.qualifying,entry.leaderboards[type].qualifying);
      assert.equal(snapshot.archived,true);
    }
    const id=await makeMatch(db);
    await finish(db,id);
    assert.deepEqual(await ledger(db),before);
    await db.query("select correct_completed_pk_match($1,'singles',$2,$3,null,null,1,'2026-10-11',null,null,'owner@example.test')",[id,people[0],people[2]]);
    await db.query("select void_pk_match($1,'Recorded incorrectly','owner@example.test')",[id]);
    assert.deepEqual(await ledger(db),before);
    const past=backup.periods.find(e=>e.elo_events.length).elo_events[0].match_id;
    await assert.rejects(()=>db.query("delete from pk_matches where id=$1",[past]),/da dong/);
    await assert.rejects(()=>db.query("select rebuild_pk_season_elo($1)",[backup.periods[1].period.id]),/lich su/);
    await assert.rejects(()=>db.exec("delete from pk_leaderboard_snapshots"),/khong the/);
    await assert.rejects(()=>db.query("update periods set pk_scoring_rule='elo_v1' where id=$1",[next]),/khong the doi/);
    const legacy="55555555-5555-4555-8555-555555555555";
    await db.query("insert into periods(id,name,status,start_date,end_date) values($1,'Other existing Elo rule','open','2026-09-10','2026-10-09')",[legacy]);
    const legacyMatch=await makeMatch(db,legacy); await finish(db,legacyMatch);
    const legacyRatings=(await db.query("select rating from pk_season_ratings where period_id=$1 order by rating desc",[legacy])).rows;
    assert.deepEqual(legacyRatings.map(r=>Number(r.rating)),[1020,980]);
  }finally{await db.close();}
});

test("closing saves both tables atomically, rejects stale input and locks future history",async()=>{
  const db=await setup();
  try{
    await db.exec(migration);
    const id=await makeMatch(db); await finish(db,id);
    const signature=(await db.query("select pk_ranking_source_signature($1) as value",[next])).rows[0].value;
    const matches=(await db.query("select * from pk_matches where period_id=$1",[next])).rows;
    const boards=Object.fromEntries(["singles","doubles"].map(t=>[t,{period_id:next,match_type:t,...buildFixedPkLeaderboard(matches,t)}]));
    const close=(sig)=>db.query("select close_period_with_pk_history($1,'{}',$2,$3)",[next,sig,boards]);
    await assert.rejects(()=>close("stale"),/Tai lai/);
    assert.equal(Number((await db.query("select count(*) as n from pk_leaderboard_snapshots where period_id=$1",[next])).rows[0].n),0);
    await db.exec(`create function test_finance_guard() returns trigger language plpgsql as $$ begin
      if NEW.status='closed' then raise exception 'fund not zero'; end if; return NEW; end; $$;
      create trigger test_finance before update on periods for each row execute function test_finance_guard();`);
    await assert.rejects(()=>close(signature),/fund not zero/);
    assert.equal(Number((await db.query("select count(*) as n from pk_leaderboard_snapshots where period_id=$1",[next])).rows[0].n),0);
    await db.exec("drop trigger test_finance on periods");
    await close(signature);
    assert.equal(Number((await db.query("select count(*) as n from pk_leaderboard_snapshots where period_id=$1",[next])).rows[0].n),2);
    await assert.rejects(()=>makeMatch(db),/da dong/);
    await assert.rejects(()=>db.query("update periods set status='open' where id=$1",[next]),/khong the mo lai/);
    await db.query("insert into periods(id,name,status,start_date,end_date,group_id) values(gen_random_uuid(),'Following','draft','2026-11-10','2026-12-09',$1)",[group]);
    assert.equal((await db.query("select pk_scoring_rule from periods where name='Following'")).rows[0].pk_scoring_rule,"fixed_3_2_v1");
    await db.exec("set role authenticated");
    await assert.rejects(()=>db.query("select close_period_with_pk_history($1,'{}','x','{}')",[next]),/permission denied/);
  }finally{await db.close();}
});

test("activation aborts without touching old history if Mùa 5 already has matches",async()=>{
  const db=await setup();
  try{
    const before=await ledger(db); await makeMatch(db);
    await assert.rejects(()=>db.exec(migration),/da co tran/);
    await db.exec("rollback");
    assert.deepEqual(await ledger(db),before);
    assert.equal((await db.query("select to_regclass('public.pk_leaderboard_snapshots') as table_name")).rows[0].table_name,null);
  }finally{await db.close();}
});

test("result correction flips points, updates differential, audits before/after, rejects stale/invalid and closed edits",async()=>{
  const db=await setup();
  try{
    await db.exec(migration); await db.exec(correction);
    const pastLedger=await ledger(db);
    const id=await makeMatch(db); await finish(db,id);
    const original=(await db.query("select *,updated_at::text as edit_token from pk_matches where id=$1",[id])).rows[0];
    const edit=(winner,scores,token=original.edit_token)=>db.query("select correct_pk_match_result($1,$2,$3,$4,'owner@example.test') as result",[id,winner,scores,token]);
    await assert.rejects(()=>edit("challenger",[{challenger:18,opponent:21}]),/does not match/);
    await assert.rejects(()=>edit("challenger",[{challenger:21.5,opponent:19}]),/format is invalid/);
    await assert.rejects(()=>edit("challenger",[{challenger:null,opponent:19}]),/format is invalid/);
    await assert.rejects(()=>edit("challenger",[{challenger:21,opponent:21}]),/one winner/);
    const result=(await edit("opponent",[{challenger:18,opponent:21}])).rows[0].result;
    assert.equal(result.match.winner_side,"opponent");
    assert.deepEqual(result.match.set_scores,[{challenger:18,opponent:21}]);
    assert.deepEqual(await ledger(db),pastLedger);
    const match=(await db.query("select * from pk_matches where id=$1",[id])).rows[0];
    const standings=buildFixedPkLeaderboard([match],"singles",{min_matches:1,min_opponents:1});
    assert.equal(standings.ranked.find(r=>r.id===people[0]).points,-2);
    assert.equal(standings.ranked.find(r=>r.id===people[1]).points,3);
    assert.equal(standings.ranked.find(r=>r.id===people[0]).score_difference,-3);
    const audit=(await db.query("select snapshot,actor_email from pk_match_audits where match_id=$1 and action='corrected'",[id])).rows;
    assert.equal(audit.length,1); assert.equal(audit[0].snapshot.before.winner_side,"challenger");
    assert.equal(audit[0].snapshot.after.winner_side,"opponent");
    await assert.rejects(()=>edit("challenger",[{challenger:21,opponent:19}]),/match changed/);
    assert.equal(Number((await db.query("select count(*) as n from pk_match_audits where match_id=$1 and action='corrected'",[id])).rows[0].n),1);
    const signature=(await db.query("select pk_ranking_source_signature($1) as value",[next])).rows[0].value;
    const boards=Object.fromEntries(["singles","doubles"].map(t=>[t,{period_id:next,match_type:t,...buildFixedPkLeaderboard([match],t)}]));
    await db.query("select close_period_with_pk_history($1,'{}',$2,$3)",[next,signature,boards]);
    const beforeSnapshots=(await db.query("select * from pk_leaderboard_snapshots order by period_id,match_type")).rows;
    await assert.rejects(()=>edit("challenger",[{challenger:21,opponent:19}]),/Closed period/);
    assert.deepEqual((await db.query("select * from pk_leaderboard_snapshots order by period_id,match_type")).rows,beforeSnapshots);
    await db.exec("set role authenticated");
    await assert.rejects(()=>edit("challenger",[{challenger:21,opponent:19}]),/permission denied/);
  }finally{await db.close();}
});
