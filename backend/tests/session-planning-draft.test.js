import test from "node:test";
import assert from "node:assert/strict";
import { buildDraft, inputVersion, validateProfile, validatePreviewRequest } from "../src/modules/session-planning/sessionPlanning.draft.js";
import { analyzeWeek } from "../src/modules/session-planning/sessionPlanning.rules.js";

const period = { id: "period", group_id: "club", status: "open", start_date: "2026-09-01", end_date: "2026-09-30" };
const week = "2026-09-07";
const members = (count) => Array.from({ length: count }, (_, i) => ({ id: `p${String(i).padStart(2, "0")}`, full_name: `Player ${i}` }));

test("draft allocates 11/12/13 members without exceeding caps, and reports honest shortages", () => {
  for (const [count, assigned, missing] of [[11, 44, 0], [12, 48, 0], [13, 48, 4]]) {
    const people = members(count);
    const draft = buildDraft(period, people, [], [], week);
    assert.equal(draft.assignments.length, assigned);
    assert.equal(draft.shortfall, missing);
    assert.equal(draft.complete, missing === 0);
    assert.ok(draft.sessions.every((row) => row.count <= 8));
    assert.ok(draft.member_counts.every((row) => row.count >= 3 && row.count <= 4));
    assert.equal(draft.published, false); assert.equal(draft.persisted, false); assert.equal(draft.cross_club_checked, false);
    assert.equal(draft.missing_level_ids.length, count);
    assert.equal(draft.assignments.some((row) => row.date === "2026-09-10"), false);
  }
});

test("level mixing, even daily load and pair preference improve draft without making pairs mandatory", () => {
  const people = members(6);
  const profiles = people.map((person, i) => ({ person_id: person.id, level: 1 + i % 3,
    preferred_partner_id: i === 0 ? people[1].id : i === 1 ? people[0].id : null }));
  const draft = buildDraft(period, people, [], profiles, week);
  assert.equal(draft.complete, true);
  assert.ok(draft.sessions.every((row) => row.count === 4));
  assert.ok(draft.sessions.every((row) => row.level_counts.every((level) => level.count > 0)));
  assert.equal(draft.pairs.length, 1); // Reciprocal preferences counted once.
  assert.ok(draft.pairs[0].shared_dates.length >= 2);
  const again = buildDraft(period, [...people].reverse(), [], [...profiles].reverse(), week);
  assert.deepEqual(again.assignments, draft.assignments);
});

test("unavailable dates win over pair preferences, including all-busy and partial weeks", () => {
  const people = members(2);
  const prefs = [
    { person_id: "p00", busy_weekdays: [2, 3, 5, 6, 7], date_overrides: { "2026-09-07": "busy" } },
    { person_id: "p01", busy_weekdays: [1, 2, 3, 5, 6, 7], date_overrides: { "2026-09-08": "available", "2026-09-10": "available" } }
  ];
  const draft = buildDraft(period, people, prefs, [{ person_id: "p00", level: null, preferred_partner_id: "p01" }], week);
  assert.deepEqual(draft.assignments, [{ person_id: "p01", date: "2026-09-08" }]);
  assert.equal(draft.pairs[0].shared_dates.length, 0); assert.equal(draft.shortfall, 7);
  const partial = buildDraft(period, members(1), [], [], "2026-09-28");
  assert.equal(partial.partial_week, true); assert.equal(partial.shortfall, 1);
  assert.equal(partial.assignments.length, 3);
  assert.equal(buildDraft(period, [], [], [], week).complete, false);
});

test("max-flow output matches independent feasibility checker over deterministic varied calendars", () => {
  let seed = 714;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let iteration = 0; iteration < 35; iteration++) {
    const people = members(1 + Math.floor(random() * 16));
    const prefs = people.map((person) => ({ person_id: person.id,
      busy_weekdays: [1, 2, 3, 5, 6, 7].filter(() => random() < 0.35), date_overrides: {} }));
    const expected = analyzeWeek(period, people, prefs, week);
    const draft = buildDraft(period, people, prefs, [], week);
    assert.equal(draft.assignments.length, expected.max_assignable_slots);
    assert.equal(draft.shortfall, expected.shortfall);
    const availability = new Map(expected.availability.map((row) => [row.person_id, row.available_dates]));
    assert.ok(draft.assignments.every((row) => availability.get(row.person_id).includes(row.date)));
    assert.equal(new Set(draft.assignments.map((row) => `${row.person_id}:${row.date}`)).size, draft.assignments.length);
  }
});

test("manual edits are independently checked: duplicate, foreign player, busy/Thursday, 9th seat and 5th visit", () => {
  const people = members(9);
  const inspect = (rows, prefs = []) => buildDraft(period, people, prefs, [], week, rows);
  const row = { person_id: "p00", date: "2026-09-07" };
  for (const bad of [[row, row], [{ ...row, person_id: "foreign" }], [{ ...row, date: "2026-09-10" }],
    [{ ...row, date: "2026-10-01" }], [{ ...row, role: "owner" }], [{ person_id: "p00" }], null,
    people.map((person) => ({ person_id: person.id, date: row.date })),
    [7, 8, 9, 11, 12].map((day) => ({ person_id: "p00", date: `2026-09-${String(day).padStart(2, "0")}` }))]) {
    assert.throws(() => inspect(bad), { statusCode: 400 });
  }
  assert.throws(() => inspect([row], [{ person_id: "p00", busy_weekdays: [1] }]), { statusCode: 400 });
  const incomplete = inspect([row]);
  assert.equal(incomplete.shortfall, 35); assert.equal(incomplete.complete, false);
});

test("input token is canonical, tracks calendars/profile/revisions/membership/scope, and includes no secret", () => {
  const people = members(2), profile = [{ person_id: "p00", level: 2, preferred_partner_id: null, revision: 1 }];
  const prefs = [{ person_id: "p00", busy_weekdays: [1, 3], date_overrides: { "2026-09-07": "available", "2026-09-08": "busy" }, revision: 2 }];
  const original = inputVersion(period, people, prefs, profile, week);
  assert.match(original, /^[a-f0-9]{64}$/);
  assert.equal(inputVersion(period, [...people].reverse(), [{ ...prefs[0], busy_weekdays: [3, 1],
    date_overrides: { "2026-09-08": "busy", "2026-09-07": "available" } }], profile, week), original);
  for (const value of [
    inputVersion(period, people.slice(1), prefs, profile, week),
    inputVersion(period, people, [{ ...prefs[0], revision: 3 }], profile, week),
    inputVersion(period, people, prefs, [{ ...profile[0], level: 3 }], week),
    inputVersion(period, people, prefs, [{ ...profile[0], preferred_partner_id: "p01" }], week),
    inputVersion({ ...period, group_id: "other" }, people, prefs, profile, week),
    inputVersion({ ...period, status: "closed" }, people, prefs, profile, week),
    inputVersion(period, people, prefs, profile, "2026-09-14")
  ]) assert.notEqual(value, original);
});

test("strict profile and preview payloads reject forged scope and invalid levels or partners", () => {
  const people = members(2), payload = { expected_revision: 0, level: null, preferred_partner_id: null };
  assert.deepEqual(validateProfile(payload, "p00", people), payload);
  for (const bad of [null, [], { ...payload, role: "owner" }, { ...payload, expected_revision: "0" },
    { ...payload, level: 0 }, { ...payload, level: 4 }, { ...payload, level: "1" },
    { ...payload, preferred_partner_id: "p00" }, { ...payload, preferred_partner_id: "foreign" }]) {
    assert.throws(() => validateProfile(bad, "p00", people), { statusCode: 400 });
  }
  const request = { week_start: week, input_version: "a".repeat(64) };
  assert.deepEqual(validatePreviewRequest(request), request);
  for (const bad of [{ ...request, assignments: null }, { ...request, input_version: 1 }, { ...request, approved: true }, null]) {
    assert.throws(() => validatePreviewRequest(bad), { statusCode: 400 });
  }
});
