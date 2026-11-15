import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNewMatch, parseResult, todayInVietnam } from "./matches.ts";
import { ValidationError } from "./profile.ts";

const allowed = new Set(["me", "a", "b", "c"]);
const today = "2026-11-20";
const base = { type: "singles", opponentId: "a", sets: 3, playDate: today };

test("the caller is always the challenger and singles carry no partners", () => {
  const match = parseNewMatch({ ...base, partnerId: "b", opponentPartnerId: "c", challengerId: "a" }, "me", allowed, today);
  assert.equal(match.challengerId, "me");
  assert.equal(match.challengerPartnerId, null);
  assert.equal(match.opponentPartnerId, null);
});

test("doubles need four different people", () => {
  const ok = parseNewMatch({ ...base, type: "doubles", partnerId: "b", opponentPartnerId: "c" }, "me", allowed, today);
  assert.deepEqual([ok.challengerId, ok.challengerPartnerId, ok.opponentId, ok.opponentPartnerId], ["me", "b", "a", "c"]);
  assert.throws(() => parseNewMatch({ ...base, type: "doubles", partnerId: "b" }, "me", allowed, today), ValidationError);
  assert.throws(() => parseNewMatch({ ...base, type: "doubles", partnerId: "a", opponentPartnerId: "c" }, "me", allowed, today), ValidationError);
});

test("players outside the group, self-challenges, past dates and odd set counts are rejected", () => {
  const bad = [
    { ...base, opponentId: "stranger" },
    { ...base, opponentId: "me" },
    { ...base, playDate: "2026-11-19" },
    { ...base, playDate: "20/11/2026" },
    { ...base, sets: 2 },
    { ...base, type: "mixed" },
    { ...base, opponentId: "" },
    null,
  ];
  for (const body of bad) assert.throws(() => parseNewMatch(body, "me", allowed, today), ValidationError);
});

test("the winner is derived from the set scores", () => {
  const scores = [{ challenger: 21, opponent: 18 }, { challenger: 17, opponent: 21 }, { challenger: 21, opponent: 19 }];
  assert.equal(parseResult({ setScores: scores }, 3).winnerSide, "challenger");
  assert.equal(parseResult({ setScores: [{ challenger: 10, opponent: 21 }] }, 3).winnerSide, "opponent");
  assert.throws(() => parseResult({ setScores: scores, winnerSide: "opponent" }, 3), ValidationError);
});

test("invalid results are rejected", () => {
  const bad = [
    {},
    { setScores: [] },
    { setScores: [{ challenger: 21, opponent: 21 }] },
    { setScores: [{ challenger: -1, opponent: 21 }] },
    { setScores: [{ challenger: 21.5, opponent: 3 }] },
    { setScores: [{ challenger: 21, opponent: 3 }, { challenger: 3, opponent: 21 }] },
    { setScores: [{ challenger: 21, opponent: 3 }, { challenger: 21, opponent: 3 }] },
  ];
  for (const body of bad.slice(0, 6)) assert.throws(() => parseResult(body, 3), ValidationError);
  // Two sets are fine for a best of three, but not for a single-set match.
  assert.equal(parseResult(bad[6], 3).winnerSide, "challenger");
  assert.throws(() => parseResult(bad[6], 1), ValidationError);
});

test("today is computed in Vietnam time", () => {
  assert.equal(todayInVietnam(new Date("2026-11-20T18:30:00Z")), "2026-11-21");
  assert.equal(todayInVietnam(new Date("2026-11-20T16:59:00Z")), "2026-11-20");
});
