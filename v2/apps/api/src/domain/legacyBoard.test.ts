import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLegacyFixedBoard, type LegacyMatch } from "./legacyBoard.ts";
// @ts-expect-error: file JavaScript của bản cũ, không có khai báo kiểu.
import { buildFixedPkLeaderboard } from "../../../../../backend/src/modules/pk-matches/pkPoints.js";

const person = (id: string, name: string) => ({ id, full_name: name, nickname: id === "d" ? "Dũng" : null, avatar_url: null });
const P = { a: person("a", "An"), b: person("b", "Bình"), c: person("c", "Chi"), d: person("d", "Dũng"), e: person("e", "Em"), f: person("f", "Phúc") };

function match(type: "singles" | "doubles", c: string[], o: string[], winner: "challenger" | "opponent", scores: [number, number][], extra: Partial<LegacyMatch> = {}): LegacyMatch {
  const pick = (id?: string) => (id ? P[id as keyof typeof P] : null);
  return {
    match_type: type,
    status: "completed",
    voided_at: null,
    winner_side: winner,
    set_scores: scores.map(([challenger, opponent]) => ({ challenger, opponent })),
    challenger_id: c[0],
    challenger_partner_id: c[1] ?? null,
    opponent_id: o[0],
    opponent_partner_id: o[1] ?? null,
    challenger: pick(c[0]),
    challenger_partner: pick(c[1]),
    opponent: pick(o[0]),
    opponent_partner: pick(o[1]),
    ...extra,
  };
}

const matches: LegacyMatch[] = [
  match("singles", ["a"], ["b"], "challenger", [[21, 15], [21, 18]]),
  match("singles", ["b"], ["c"], "challenger", [[21, 10]]),
  match("singles", ["c"], ["a"], "challenger", [[21, 19], [15, 21], [21, 17]]),
  match("singles", ["d"], ["e"], "opponent", [[10, 21]]),
  match("singles", ["a"], ["e"], "challenger", [[21, 5]], { voided_at: "2026-11-01T00:00:00Z" }),
  match("singles", ["a"], ["f"], "challenger", [[21, 5]], { status: "cancelled" }),
  match("doubles", ["a", "b"], ["c", "d"], "challenger", [[21, 19]]),
  match("doubles", ["c", "d"], ["a", "b"], "challenger", [[21, 19]]),
  match("doubles", ["e", "f"], ["a", "c"], "opponent", [[18, 21], [21, 23]]),
  match("doubles", ["b", "d"], ["e", "f"], "challenger", [[21, 12]]),
];

test("the archived board is byte-for-byte what the old app builds, for singles and doubles", () => {
  for (const type of ["singles", "doubles"]) {
    assert.deepEqual(buildLegacyFixedBoard(matches, type), buildFixedPkLeaderboard(matches, type));
  }
});

test("invalid completed matches fail the same way as the old builder", () => {
  const broken = [match("singles", ["a"], ["b"], "challenger", [[21, 21]])];
  assert.throws(() => buildLegacyFixedBoard(broken, "singles"), /tỷ số set hợp lệ/);
  assert.throws(() => buildFixedPkLeaderboard(broken, "singles"), /tỷ số set hợp lệ/);
});
