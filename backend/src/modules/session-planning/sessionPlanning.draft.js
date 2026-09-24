import { createHash } from "node:crypto";
import { analyzeWeek, planningError, SCHEDULE_RULES } from "./sessionPlanning.rules.js";

// Provisional manual scale, isolated from PK ratings and financial calculations.
export const PLANNING_LEVELS = Object.freeze([
  { value: 1, label: "Mới" }, { value: 2, label: "Trung bình" }, { value: 3, label: "Khá–mạnh" }
]);

function objectWithKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key));
}

export function validateProfile(payload, personId, members) {
  if (!objectWithKeys(payload, ["expected_revision", "level", "preferred_partner_id"]) ||
      !Number.isSafeInteger(payload.expected_revision) || payload.expected_revision < 0 || payload.expected_revision > 2147483646 ||
      !(payload.level === null || PLANNING_LEVELS.some(({ value }) => value === payload.level)) ||
      !(payload.preferred_partner_id === null || (payload.preferred_partner_id !== personId &&
        members.some((person) => person.id === payload.preferred_partner_id)))) {
    throw planningError("Hồ sơ xếp lịch không hợp lệ. Chọn level và người đi cùng đủ điều kiện trong kỳ; không được chọn chính mình.");
  }
  return { expected_revision: payload.expected_revision, level: payload.level, preferred_partner_id: payload.preferred_partner_id };
}

// A diagnostic preview uses a snapshot token, never as authorization to reserve a seat.
export function inputVersion(period, members, preferences, profiles, weekStart) {
  const prefs = new Map(preferences.map((row) => [row.person_id, row]));
  const skills = new Map(profiles.map((row) => [row.person_id, row]));
  const value = {
    algorithm: "draft-preview-v1", period: [period.id, period.group_id, period.status, period.start_date, period.end_date],
    week_start: weekStart, rules: SCHEDULE_RULES,
    members: [...members].sort((a, b) => a.id.localeCompare(b.id)).map((person) => {
      const preference = prefs.get(person.id), profile = skills.get(person.id);
      return [person.id, person.full_name, preference?.revision || 0,
        [...(preference?.busy_weekdays || [])].sort((a, b) => a - b),
        Object.entries(preference?.date_overrides || {}).sort(([a], [b]) => a.localeCompare(b)),
        profile?.revision || 0, profile?.level ?? null, profile?.preferred_partner_id ?? null];
    })
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validatePreviewRequest(payload) {
  if (!objectWithKeys(payload, ["week_start", "input_version", "assignments"]) ||
      typeof payload.input_version !== "string" || !/^[a-f0-9]{64}$/.test(payload.input_version) ||
      typeof payload.week_start !== "string" ||
      (Object.hasOwn(payload, "assignments") && !Array.isArray(payload.assignments))) {
    throw planningError("Yêu cầu xếp thử không hợp lệ. Hãy tải lại dữ liệu đầu vào.");
  }
  return payload;
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function preferredPairs(members, profiles) {
  const ids = new Set(members.map((person) => person.id));
  const pairs = new Map();
  for (const row of profiles) {
    if (!ids.has(row.person_id) || !ids.has(row.preferred_partner_id) || row.person_id === row.preferred_partner_id) continue;
    const pair = [row.person_id, row.preferred_partner_id].sort();
    pairs.set(pair.join(":"), pair); // A -> B and B -> A are one soft preference, not two.
  }
  return [...pairs.values()].sort(([a, b], [c, d]) => a.localeCompare(c) || b.localeCompare(d));
}

// Exact min-cost max-flow: maximize allocated visits first, then spread deficits and loads.
// Separate unit source edges make a fourth visit more expensive than anyone's first three.
function initialAssignments(analysis) {
  const people = [...analysis.availability].sort((a, b) => a.person_id.localeCompare(b.person_id));
  const source = 0, sink = 1 + people.length + analysis.dates.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const links = [];
  function edge(from, to, cost) {
    const link = { to, capacity: 1, cost, reverse: graph[to].length };
    graph[from].push(link);
    graph[to].push({ to: from, capacity: 0, cost: -cost, reverse: graph[from].length - 1 });
    return link;
  }
  people.forEach((person, index) => {
    for (let visit = 0; visit < 4; visit++) edge(source, index + 1, visit * 10000);
    analysis.dates.forEach((date, day) => {
      if (person.available_dates.includes(date)) links.push({ person_id: person.person_id, date,
        edge: edge(index + 1, people.length + day + 1, 0) });
    });
  });
  analysis.dates.forEach((date, day) => {
    for (let slot = 0; slot < 8; slot++) edge(people.length + day + 1, sink, slot * 100);
  });
  for (;;) {
    // Bellman-Ford also handles negative-cost residual edges; deterministic tie-breaking.
    const distance = Array(graph.length).fill(Infinity), parent = Array(graph.length).fill(null);
    distance[source] = 0;
    for (let pass = 0; pass < graph.length - 1; pass++) {
      let changed = false;
      graph.forEach((edges, from) => {
        edges.forEach((link, index) => {
          if (link.capacity > 0 && distance[from] + link.cost < distance[link.to]) {
            distance[link.to] = distance[from] + link.cost;
            parent[link.to] = [from, index]; changed = true;
          }
        });
      });
      if (!changed) break;
    }
    if (!parent[sink]) break;
    for (let node = sink; node !== source; node = parent[node][0]) {
      const [from, index] = parent[node], link = graph[from][index];
      link.capacity--; graph[node][link.reverse].capacity++;
    }
  }
  return links.filter((link) => link.edge.capacity === 0).map(({ person_id, date }) => ({ person_id, date }));
}

// Bounded local optimization, not a claim of globally optimal pair/level matching.
// Every move preserves each member's quota and all hard availability/capacity constraints.
function optimize(assignments, analysis, profiles, pairs) {
  const levelById = new Map(profiles.map((row) => [row.person_id, row.level]));
  const available = new Map(analysis.availability.map((row) => [row.person_id, new Set(row.available_dates)]));
  function score(rows) {
    const days = analysis.dates.map((date) => rows.filter((row) => row.date === date));
    const totals = [1, 2, 3].map((level) => rows.filter((row) => levelById.get(row.person_id) === level).length);
    const known = totals.reduce((sum, value) => sum + value, 0);
    const load = days.reduce((sum, day) => sum + day.length ** 2, 0);
    const mixing = days.reduce((sum, day) => {
      const counts = [1, 2, 3].map((level) => day.filter((row) => levelById.get(row.person_id) === level).length);
      const n = counts.reduce((count, value) => count + value, 0);
      return sum + counts.reduce((cost, value, index) => cost + (value * known - totals[index] * n) ** 2, 0);
    }, 0);
    const together = pairs.reduce((sum, [a, b]) => sum + days.filter((day) =>
      day.some((row) => row.person_id === a) && day.some((row) => row.person_id === b)).length, 0);
    return [load, mixing, -together];
  }
  let result = assignments, best = score(result);
  for (let iteration = 0; iteration < 64; iteration++) {
    let next = null, nextScore = best;
    function consider(candidate) {
      const value = score(candidate);
      if (compare(value, nextScore) < 0) { next = candidate; nextScore = value; }
    }
    result.forEach((row, index) => {
      for (const date of available.get(row.person_id)) {
        if (result.some((entry) => entry.person_id === row.person_id && entry.date === date) ||
          result.filter((entry) => entry.date === date).length >= 8) continue;
        consider(result.map((entry, i) => i === index ? { ...entry, date } : entry));
      }
      result.slice(index + 1).forEach((other, offset) => {
        if (row.person_id === other.person_id || row.date === other.date ||
          !available.get(row.person_id).has(other.date) || !available.get(other.person_id).has(row.date) ||
          result.some((entry) => (entry.person_id === row.person_id && entry.date === other.date) ||
            (entry.person_id === other.person_id && entry.date === row.date))) return;
        consider(result.map((entry, i) => i === index ? { ...entry, date: other.date }
          : i === index + offset + 1 ? { ...entry, date: row.date } : entry));
      });
    });
    if (!next) break;
    result = next; best = nextScore;
  }
  return result;
}

export function inspectAssignments(assignments, analysis, members, profiles) {
  if (!Array.isArray(assignments) || assignments.length > 48) throw planningError("Bản nháp không hợp lệ: tối đa 48 lượt mỗi tuần.");
  const availability = new Map(analysis.availability.map((row) => [row.person_id, new Set(row.available_dates)]));
  const seen = new Set(), counts = new Map(), dayCounts = new Map();
  for (const row of assignments) {
    if (!objectWithKeys(row, ["person_id", "date"]) || !availability.get(row.person_id)?.has(row.date)) {
      throw planningError("Bản nháp chứa người/ngày không hợp lệ hoặc xếp vào ngày đã báo bận.");
    }
    const key = `${row.person_id}:${row.date}`;
    if (seen.has(key)) throw planningError("Một người không được có hai chỗ trong cùng ngày.");
    seen.add(key);
    counts.set(row.person_id, (counts.get(row.person_id) || 0) + 1);
    dayCounts.set(row.date, (dayCounts.get(row.date) || 0) + 1);
    if (counts.get(row.person_id) > 4 || dayCounts.get(row.date) > 8) throw planningError("Nháp cố định không được vượt 4 buổi/người hoặc 8 người/buổi.");
  }
  const levelById = new Map(profiles.map((row) => [row.person_id, row.level]));
  const pairs = preferredPairs(members, profiles);
  const personCounts = members.map((person) => ({ person_id: person.id, count: counts.get(person.id) || 0,
    missing: 4 - (counts.get(person.id) || 0) }));
  const shortfall = personCounts.reduce((sum, person) => sum + person.missing, 0);
  return {
    assignments: [...assignments].sort((a, b) => a.date.localeCompare(b.date) || a.person_id.localeCompare(b.person_id)),
    member_counts: personCounts, shortfall, complete: members.length > 0 && shortfall === 0,
    sessions: analysis.dates.map((date) => ({ date, count: dayCounts.get(date) || 0,
      level_counts: [1, 2, 3].map((level) => ({ level, count: assignments.filter((row) => row.date === date && levelById.get(row.person_id) === level).length })),
      unknown_level: assignments.filter((row) => row.date === date && !levelById.get(row.person_id)).length })),
    pairs: pairs.map(([a, b]) => ({ person_ids: [a, b], shared_dates: analysis.dates.filter((date) => seen.has(`${a}:${date}`) && seen.has(`${b}:${date}`)) })),
    missing_level_ids: members.filter((person) => !levelById.get(person.id)).map((person) => person.id),
    partial_week: analysis.partial_week,
    // Explicitly not a confirmed plan: cross-club bookings and cancellations are a later stage.
    stage: "draft_preview", persisted: false, published: false, cross_club_checked: false,
    checked_at: new Date().toISOString()
  };
}

export function buildDraft(period, members, preferences, profiles, weekStart, suppliedAssignments) {
  const analysis = analyzeWeek(period, members, preferences, weekStart);
  const assignments = suppliedAssignments === undefined
    ? optimize(initialAssignments(analysis), analysis, profiles, preferredPairs(members, profiles)) : suppliedAssignments;
  return inspectAssignments(assignments, analysis, members, profiles);
}
