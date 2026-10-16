import test from "node:test";
import assert from "node:assert/strict";
import { pkMatchesService as service } from "../src/modules/pk-matches/pkMatches.service.js";
import { pkMatchesRepository as repo } from "../src/modules/pk-matches/pkMatches.repository.js";

const payload={winner_side:"challenger",set_scores:[{challenger:21,opponent:19}],expected_updated_at:"2026-10-11T00:00:00Z"};
test("player cannot correct locked results, while admin passes only result fields with trusted actor",async(t)=>{
  t.mock.method(repo,"getScoringRule",async()=>({data:{status:"open"}}));
  await assert.rejects(()=>service.correctResult("id",payload,false),e=>e.statusCode===403);
  t.mock.method(service,"getById",async()=>({period_id:"current",status:"completed",sets:1}));
  const rpc=t.mock.method(repo,"correctResult",async(id,body,email)=>{
    assert.equal(id,"id");assert.equal(body.expected_updated_at,payload.expected_updated_at);assert.equal(email,"owner@test.local");
    return {data:{match:{id,winner_side:body.winner_side}}};
  });
  assert.equal((await service.correctResult("id",payload,true,{email:"owner@test.local"})).winner_side,"challenger");
  assert.equal(rpc.mock.callCount(),1);
  await assert.rejects(()=>service.correctResult("id",{...payload,set_scores:[{challenger:21,opponent:21}]},true),/không hợp lệ/);
  await assert.rejects(()=>service.correctResult("id",{...payload,expected_updated_at:null},true),/Tải lại/);
  assert.equal(rpc.mock.callCount(),1);
});
test("result editor reports stale changes and missing migration without fallback mutation",async(t)=>{
  t.mock.method(repo,"getScoringRule",async()=>({data:{status:"open"}}));
  t.mock.method(service,"getById",async()=>({period_id:"current",status:"completed",sets:1}));
  const rpc=t.mock.method(repo,"correctResult",async()=>({error:{code:"PGRST202",message:"missing"}}));
  await assert.rejects(()=>service.correctResult("id",payload,true),/20261011_pk_result_correction/);
  rpc.mock.mockImplementation(async()=>({error:{message:"PK match changed; reload before correcting"}}));
  await assert.rejects(()=>service.correctResult("id",payload,true),e=>e.statusCode===409);
});
