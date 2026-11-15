import assert from "node:assert/strict";
import { test } from "node:test";
import { buildKnockoutMatches } from "./knockout.ts";

test("two groups into semifinals cross first and second, with a third-place match fed by the losers", () => {
  const defs = buildKnockoutMatches({ knockoutStart: "semifinal", thirdPlace: true, groups: [["A1", "A2", "A3"], ["B1", "B2"]], lastMatchNumber: 12 });
  assert.deepEqual(
    defs.map((d) => [d.key, d.match_number, d.team1_id, d.team2_id, d.next_key, d.next_slot, d.loser_next_key, d.loser_next_slot]),
    [
      ["SF1", 13, "A1", "B2", "F1", 1, "TP1", 1],
      ["SF2", 14, "B1", "A2", "F1", 2, "TP1", 2],
      ["F1", 15, null, null, null, null, null, null],
      ["TP1", 16, null, null, null, null, null, null],
    ],
  );
  assert.equal(defs[0].team1_source, "Nhất bảng A");
  assert.equal(defs[2].team1_source, "Thắng bán kết 1");
});

test("three groups into quarterfinals leave byes where the old app left them", () => {
  const defs = buildKnockoutMatches({ knockoutStart: "quarterfinal", thirdPlace: false, groups: [["A1", "A2"], ["B1", "B2"], ["C1", "C2"]], lastMatchNumber: 0 });
  const quarters = defs.filter((d) => d.stage === "quarterfinal").map((d) => [d.team1_id, d.team2_id]);
  assert.deepEqual(quarters, [
    ["A1", null],
    ["C1", "B2"],
    ["B1", null],
    ["A2", "C2"],
  ]);
  assert.equal(defs.length, 7);
  assert.ok(defs.every((d) => d.loser_next_key === null));
});

test("one group goes straight to a final; too many qualifiers for the chosen round is refused", () => {
  assert.deepEqual(
    buildKnockoutMatches({ knockoutStart: "final", thirdPlace: true, groups: [["A1", "A2"]], lastMatchNumber: 3 }).map((d) => [d.key, d.team1_id, d.team2_id]),
    [["F1", "A1", "A2"]],
  );
  assert.throws(() => buildKnockoutMatches({ knockoutStart: "semifinal", thirdPlace: false, groups: [["A1", "A2"], ["B1", "B2"], ["C1", "C2"]], lastMatchNumber: 0 }));
});
