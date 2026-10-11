import test from "node:test";
import assert from "node:assert/strict";
import { buildFixedPkLeaderboard } from "../src/modules/pk-matches/pkPoints.js";
import { pkMatchesService } from "../src/modules/pk-matches/pkMatches.service.js";
import { pkMatchesRepository as repo } from "../src/modules/pk-matches/pkMatches.repository.js";

const minimal = { min_matches: 1, min_opponents: 1 };
const game = (a, b, scores = [[21,19]], partners = []) => ({
  match_type: partners.length ? "doubles" : "singles", status: "completed", winner_side: "challenger",
  challenger_id: a, opponent_id: b, challenger_partner_id: partners[0], opponent_partner_id: partners[1],
  challenger: { full_name: a }, opponent: { full_name: b },
  challenger_partner: { full_name: partners[0] }, opponent_partner: { full_name: partners[1] },
  set_scores: scores.map(([challenger, opponent]) => ({ challenger, opponent })),
});

test("all matches have fixed +3/−2, negatives allowed and all set rally points count", () => {
  const matches = [game("A","B",[[21,19],[15,21],[21,18]]), game("A","C")];
  const result = buildFixedPkLeaderboard(matches,"singles",minimal);
  const a = result.ranked.find((r) => r.id === "A"), b = result.ranked.find((r) => r.id === "B");
  assert.equal(a.points, 6); assert.equal(b.points,-2);
  assert.equal(a.score_for, 78); assert.equal(a.score_against,77); assert.equal(a.score_difference,1);
  const long = buildFixedPkLeaderboard(Array.from({length:6},()=>game("A","B")),"singles",minimal);
  assert.equal(long.ranked.find((r)=>r.id==="A").points,18);
  assert.equal(long.ranked.find((r)=>r.id==="B").points,-12);
});

test("rotating doubles partners get personal totals and own opponents", () => {
  const result = buildFixedPkLeaderboard([game("A","B",[[21,15]],["C","D"]),
    game("B","A",[[21,19]],["C","E"])],"doubles",minimal);
  const find = (id) => result.ranked.find((r)=>r.id===id);
  assert.equal(find("A").points,1); assert.equal(find("C").points,6);
  assert.equal(find("A").score_difference,4); assert.equal(find("C").score_difference,8);
  assert.equal(find("E").points,-2); assert.equal(find("A").distinct_opponents,3);
});

test("equal points use rally differential first, then direct meetings", () => {
  const req = {min_matches:2,min_opponents:2};
  const games = [game("A","B"),game("C","A"),game("B","D")];
  const result = buildFixedPkLeaderboard(games,"singles",req);
  assert.deepEqual(result.ranked.map((r)=>[r.id,r.points,r.score_difference,r.rank]),[["A",1,0,1],["B",1,0,2]]);
  assert.equal(result.ranked[0].head_to_head_wins,1); assert.equal(result.ranked[1].head_to_head_losses,1);
  const diff = buildFixedPkLeaderboard([game("A","B",[[21,20]]),game("C","A",[[21,10]]),game("B","D",[[21,15]])],"singles",req);
  assert.equal(diff.ranked[0].id,"B");
});

test("unresolved or incomplete head-to-head ties stay same rank without a name tiebreak", () => {
  const result = buildFixedPkLeaderboard([game("A","B"),game("B","C"),game("C","D"),game("D","A")],"singles",minimal);
  assert.ok(result.ranked.every((r)=>r.rank===1 && r.tied_rank && !r.head_to_head_applied));
  const draw = buildFixedPkLeaderboard([game("A","B"),game("B","A")],"singles",minimal);
  assert.ok(draw.ranked.every((r)=>r.rank===1 && r.head_to_head_applied));
});

test("voided, cancelled and other disciplines do not count; missing valid scores are not guessed", () => {
  const result=buildFixedPkLeaderboard([game("A","B"),{...game("A","C"),voided_at:"now"},
    {...game("A","C"),status:"cancelled"},game("A","C",[[21,19]],["D","E"])],"singles",minimal);
  assert.equal(result.ranked.find((r)=>r.id==="A").points,3);
  assert.throws(()=>buildFixedPkLeaderboard([{...game("A","B"),set_scores:null}],"singles",minimal),/tỷ số/);
  assert.equal(buildFixedPkLeaderboard([game("A","B")],"singles").ranked.length,0);
});

test("API uses frozen snapshots before any scoring formula and applies new rule only to selected period", async(t)=>{
  const frozen={period_id:"old",match_type:"singles",scoring_method:"elo",archived:true,ranked:[{id:"X",rank:1,points:1234}],qualifying:[]};
  t.mock.method(repo,"getSnapshot",async(id)=>({data:id==="old"?{result:frozen}:null}));
  t.mock.method(repo,"getArchivedPlayerAvatars",async()=>({data:[]}));
  const policy=t.mock.method(repo,"getScoringRule",async()=>({data:{status:"open",pk_scoring_rule:"fixed_3_2_v1"}}));
  t.mock.method(repo,"getRankingMatches",async()=>({data:[game("A","B")]}));
  t.mock.method(repo,"getSeasonRatings",async()=>assert.fail("New rule must not read Elo ledger"));
  assert.deepEqual(await pkMatchesService.getLeaderboard("old","singles"),frozen);
  assert.equal(policy.mock.callCount(),0);
  assert.equal((await pkMatchesService.getLeaderboard("new","singles")).qualifying[0].points,3);
});

test("missing migration or missing old snapshot reports an error instead of a fake empty history",async(t)=>{
  const snapshot=t.mock.method(repo,"getSnapshot",async()=>({error:{code:"42P01",message:"missing table"}}));
  t.mock.method(repo,"getSeasonRatings",async()=>assert.fail("Closed history must not be recalculated"));
  await assert.rejects(()=>pkMatchesService.getLeaderboard("old","doubles"),/20261011_pk_fixed_points/);
  snapshot.mock.mockImplementation(async()=>({data:null}));
  t.mock.method(repo,"getScoringRule",async()=>({data:{status:"closed",pk_scoring_rule:"elo_v1"}}));
  await assert.rejects(()=>pkMatchesService.getLeaderboard("old","doubles"),/Không tự tính lại/);
});
