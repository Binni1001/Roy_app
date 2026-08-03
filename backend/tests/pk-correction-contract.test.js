import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("completed PK corrections are audited and rebuild seasonal Elo", () => {
  const migration = read("../supabase/20260803_correct_completed_pk_match.sql");

  assert.match(migration, /create or replace function public\.correct_completed_pk_match/);
  assert.match(migration, /current_setting\('app\.pk_correction'/);
  assert.match(migration, /'corrected'/);
  assert.match(migration, /public\.rebuild_pk_season_elo\(v_match\.period_id\)/);
  assert.match(migration, /grant execute on function public\.correct_completed_pk_match/);
  assert.match(migration, /to service_role/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});

test("only admin roles can reach completed correction through the update service", () => {
  const controller = read("src/modules/pk-matches/pkMatches.controller.js");
  const service = read("src/modules/pk-matches/pkMatches.service.js");
  const repository = read("src/modules/pk-matches/pkMatches.repository.js");

  assert.match(controller, /req\.authRole === "admin" \|\| req\.authRole === "owner"/);
  assert.match(service, /if \(isAdmin && !existing\.voided_at\)/);
  assert.match(service, /pkMatchesRepository\.correctCompleted/);
  assert.match(service, /20260803_correct_completed_pk_match\.sql/);
  assert.match(repository, /rpc\("correct_completed_pk_match"/);
});
