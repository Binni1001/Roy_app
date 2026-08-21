import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("tournament module is mounted and protects every write with admin role", () => {
  const app = read("src/app.js");
  const routes = read("src/modules/tournaments/tournaments.routes.js");

  assert.match(app, /app\.use\("\/api\/tournaments", tournamentsRoutes\)/);
  assert.match(routes, /router\.get\("\/", requireAuth/);
  assert.match(routes, /router\.post\("\/", requireAuth, requireAdmin/);
  assert.match(routes, /router\.put\("\/:id", requireAuth, requireAdmin/);
  assert.match(routes, /router\.put\("\/:id\/configure", requireAuth, requireAdmin/);
  assert.match(routes, /router\.post\("\/:id\/knockout", requireAuth, requireAdmin/);
  assert.match(routes, /router\.put\("\/:id\/matches\/:matchId", requireAuth, requireAdmin/);
  assert.match(routes, /router\.delete\("\/:id", requireAuth, requireAdmin/);
});

test("tournament data stays separate from PK and supports complete bracket correction", () => {
  const service = read("src/modules/tournaments/tournaments.service.js");
  const repository = read("src/modules/tournaments/tournaments.repository.js");
  const migration = read("../supabase/20260821_doubles_tournaments.sql");

  assert.doesNotMatch(migration, /references public\.pk_matches/);
  assert.doesNotMatch(service, /pkMatches/);
  assert.match(migration, /create table if not exists public\.tournaments/);
  assert.match(migration, /create table if not exists public\.tournament_teams/);
  assert.match(migration, /create table if not exists public\.tournament_team_members/);
  assert.match(migration, /create table if not exists public\.tournament_groups/);
  assert.match(migration, /create table if not exists public\.tournament_matches/);
  assert.match(migration, /configure_doubles_tournament/);
  assert.match(migration, /replace_tournament_knockout/);
  assert.match(migration, /save_tournament_match/);
  assert.match(migration, /with recursive branch/);
  assert.match(repository, /configure_doubles_tournament/);
  assert.match(repository, /replace_tournament_knockout/);
  assert.match(repository, /save_tournament_match/);
});

test("round robin standings and knockout rules match the approved format", () => {
  const service = read("src/modules/tournaments/tournaments.service.js");

  assert.match(service, /standing_points \+= 3/);
  assert.match(service, /set_difference/);
  assert.match(service, /point_difference/);
  assert.match(service, /headToHead/);
  assert.match(service, /Nhất bảng A/);
  assert.match(service, /Nhì bảng B/);
  assert.match(service, /quarterfinal/);
  assert.match(service, /semifinal/);
  assert.match(service, /third_place/);
  assert.match(service, /groupMatches\.some\(\(match\) => match\.status !== "completed"\)/);
});

test("tournament team picker only exposes active members from the selected group", () => {
  const peopleRepository = read("src/modules/people/people.repository.js");
  const setup = read("../frontend/src/features/admin/panels/tournaments/TournamentSetupModal.jsx");
  const utils = read("../frontend/src/features/tournaments/tournamentUtils.js");

  assert.match(peopleRepository, /person_groups\(group_id, status, member_role\)/);
  assert.match(utils, /person\?\.full_name \|\| person\?\.nickname/);
  assert.match(utils, /membership\.group_id === groupId && membership\.status === 'active'/);
  assert.match(setup, /selectedMemberIds/);
  assert.match(setup, /availablePeople\(currentPersonId\)/);
});

test("tournament schedule groups round-robin matches by named group", () => {
  const schedule = read("../frontend/src/features/tournaments/TournamentSchedule.jsx");
  const view = read("../frontend/src/features/tournaments/TournamentView.jsx");
  const card = read("../frontend/src/features/tournaments/TournamentMatchCard.jsx");

  assert.match(view, /<TournamentSchedule groups=\{tournament\.groups\}/);
  assert.match(schedule, /group\.matches/);
  assert.match(schedule, /`Bảng \$\{code\}`/);
  assert.match(schedule, /`\$\{name\} · Trận \$\{matchIndex \+ 1\}`/);
  assert.match(schedule, /Vòng loại trực tiếp/);
  assert.match(card, /label \|\| `\$\{stageLabel\(match\.stage\)\}/);
});
