import assert from "node:assert/strict";
import { test } from "node:test";
import type { TournamentMatch, TournamentTeam } from "@roy/shared";
import type { TournamentData } from "./routes/extras.ts";
import { bearer, setup, token, tournament } from "./testkit.ts";

const owner = async () => ({
  Authorization: `Bearer ${await token({ email: "a@b.c", app_metadata: { role: "owner" } })}`,
});

const team = (id: string): TournamentTeam => ({ id, name: id, seed: null, players: [] });
const groupMatch = (id: string, t1: string, t2: string, winner: string | null, n: number): TournamentMatch => ({
  id,
  stage: "group",
  groupId: "ga",
  bracketKey: null,
  matchNumber: n,
  status: winner ? "completed" : "pending",
  team1: team(t1),
  team2: team(t2),
  team1Source: null,
  team2Source: null,
  team1Sets: winner === t1 ? 2 : 0,
  team2Sets: winner === t2 ? 2 : 0,
  setScores: winner ? [{ team1: winner === t1 ? 21 : 10, team2: winner === t2 ? 21 : 10 }] : null,
  winnerTeamId: winner,
});
const withGroup = (status: string, winners: (string | null)[]): TournamentData => ({
  ...tournament("g1", status),
  teams: ["x", "y", "z"].map(team),
  groups: [{ id: "ga", name: "Bảng A", teamIds: ["x", "y", "z"] }],
  matches: [groupMatch("tm1", "x", "y", winners[0], 1), groupMatch("tm2", "y", "z", winners[1], 2), groupMatch("tm3", "x", "z", winners[2], 3)],
});

const players = async () => ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id, avatarUrl: null }));
const teams = [
  { name: "A", groupIndex: 1, memberIds: ["a", "b"] },
  { name: "B", groupIndex: 1, memberIds: ["c", "d"] },
];

test("only the owner manages tournaments, and drafts of another group stay hidden", async () => {
  const app = setup();
  assert.equal((await app.get(await bearer(), "/admin/tournaments")).status, 403);
  assert.equal((await app.get(await owner(), "/admin/tournaments")).status, 200);
  assert.equal((await app.get(await owner(), "/admin/tournaments/t1")).status, 200);
  const other = setup({ getTournament: async () => tournament("other", "draft") });
  assert.equal((await other.get(await owner(), "/admin/tournaments/t1")).status, 404);
});

test("a new tournament is validated and created as a draft", async () => {
  const created: unknown[] = [];
  const app = setup({ createTournament: async (groupId, input) => (created.push([groupId, input.name, input.groupCount, input.knockoutStart]), "t1") });
  assert.equal((await app.post(await owner(), "/admin/tournaments", { name: "Giải mùa đông", groupCount: 2 })).status, 200);
  assert.deepEqual(created, [["g1", "Giải mùa đông", 2, "semifinal"]]);
  for (const body of [{ name: "G" }, { name: "Giải", groupCount: 5 }, { name: "Giải", bestOf: 2 }, { name: "Giải", groupCount: 3, knockoutStart: "semifinal" }]) {
    assert.equal((await app.post(await owner(), "/admin/tournaments", body)).status, 400, JSON.stringify(body));
  }
});

test("teams are configured only on a draft, with two group members each and nobody twice", async () => {
  const configured: unknown[] = [];
  const draft = setup({
    getTournament: async () => tournament("g1", "draft"),
    listGroupPlayers: players,
    configureTournament: async (id, t, s) => void configured.push([id, t.length, s.groupCount]),
  });
  assert.equal((await draft.post(await owner(), "/admin/tournaments/t1/configure", { groupCount: 1, knockoutStart: "final", teams })).status, 200);
  assert.deepEqual(configured, [["t1", 2, 1]]);
  const bad = [
    [{ ...teams[0], memberIds: ["a"] }, teams[1]],
    [teams[0], { ...teams[1], memberIds: ["a", "c"] }],
    [teams[0], { ...teams[1], memberIds: ["c", "stranger"] }],
    [teams[0], { ...teams[1], groupIndex: 2 }],
    [teams[0]],
  ];
  for (const t of bad) assert.equal((await draft.post(await owner(), "/admin/tournaments/t1/configure", { groupCount: 1, knockoutStart: "final", teams: t })).status, 400);
  const live = setup({ getTournament: async () => tournament("g1", "group_stage"), listGroupPlayers: players });
  assert.equal((await live.post(await owner(), "/admin/tournaments/t1/configure", { groupCount: 1, knockoutStart: "final", teams })).status, 409);
  assert.equal(configured.length, 1);
});

test("publishing needs teams and a schedule", async () => {
  const empty = setup({ getTournament: async () => tournament("g1", "draft") });
  assert.equal((await empty.post(await owner(), "/admin/tournaments/t1/publish")).status, 409);
  const statuses: string[] = [];
  const ready = setup({ getTournament: async () => withGroup("draft", [null, null, null]), setTournamentStatus: async (_id, s) => void statuses.push(s) });
  assert.equal((await ready.post(await owner(), "/admin/tournaments/t1/publish")).status, 200);
  assert.deepEqual(statuses, ["group_stage"]);
});

test("the knockout is built from the group standings once every group match is done", async () => {
  const built: unknown[] = [];
  const unfinished = setup({ getTournament: async () => withGroup("group_stage", ["x", null, "x"]), replaceKnockout: async () => void built.push("no") });
  assert.equal((await unfinished.post(await owner(), "/admin/tournaments/t1/knockout")).status, 409);
  const done = setup({
    getTournament: async () => withGroup("group_stage", ["x", "y", "x"]),
    replaceKnockout: async (_id, defs) => void built.push(defs.map((d) => [d.key, d.team1_id, d.team2_id, d.match_number])),
  });
  assert.equal((await done.post(await owner(), "/admin/tournaments/t1/knockout")).status, 200);
  // x thắng 2 trận, y thắng 1: chung kết x gặp y, số trận nối tiếp vòng bảng.
  assert.deepEqual(built, [[["F1", "x", "y", 4]]]);
});

test("a group score after the knockout exists needs confirmation and then rebuilds the knockout", async () => {
  const calls: string[] = [];
  const withKnockout = (): TournamentData => {
    const data = withGroup("knockout", ["x", "y", "x"]);
    return { ...data, matches: [...data.matches, { ...groupMatch("f1", "x", "y", null, 4), stage: "final", groupId: null }] };
  };
  const app = setup({
    getTournament: async () => withKnockout(),
    saveTournamentMatch: async (id, status, scores) => void calls.push(`save:${id}:${status}:${scores.length}`),
    replaceKnockout: async () => void calls.push("rebuild"),
  });
  const score = { setScores: [{ team1: 21, team2: 15 }, { team1: 21, team2: 19 }] };
  const ask = await app.put(await owner(), "/admin/tournament-matches/tm1", score);
  assert.equal(ask.status, 409);
  assert.equal((await ask.json()).code, "CONFIRM_REBUILD");
  assert.equal((await app.put(await owner(), "/admin/tournament-matches/tm1", { status: "pending", rebuildKnockout: true })).status, 409);
  assert.equal((await app.put(await owner(), "/admin/tournament-matches/tm1", { ...score, rebuildKnockout: true })).status, 200);
  assert.deepEqual(calls, ["save:tm1:completed:2", "rebuild"]);
  assert.equal((await app.put(await owner(), "/admin/tournament-matches/tm1", { setScores: [{ team1: 21, team2: 21 }], rebuildKnockout: true })).status, 400);
  assert.equal((await app.put(await owner(), "/admin/tournament-matches/nope", score)).status, 404);
});

test("only a draft or cancelled tournament can be deleted", async () => {
  const live = setup({ getTournament: async () => tournament("g1", "group_stage") });
  assert.equal((await live.del(await owner(), "/admin/tournaments/t1")).status, 409);
  const deleted: string[] = [];
  const draft = setup({ getTournament: async () => tournament("g1", "draft"), deleteTournament: async (id) => void deleted.push(id) });
  assert.equal((await draft.del(await owner(), "/admin/tournaments/t1")).status, 200);
  assert.deepEqual(deleted, ["t1"]);
});
