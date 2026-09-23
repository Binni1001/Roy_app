// Stage 1: planning inputs and feasibility only. No bookings or finance writes.
export const SCHEDULE_RULES = Object.freeze({
  capacity: 8,
  fixed_sessions_per_week: 4,
  playing_weekdays: Object.freeze([1, 2, 3, 5, 6, 7]), // ISO: Monday = 1
  start_time: "17:30",
  end_time: "19:30",
  timezone: "Asia/Ho_Chi_Minh",
  cancellation_cutoff: "12:00",
  guest_priority: "fixed_first",
  parity_restriction: false
});

export function planningError(message, statusCode = 400, code = "PLANNING_INVALID_INPUT") {
  return Object.assign(new Error(message), { statusCode, code });
}

export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(value, count) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function weekday(value) {
  return new Date(`${value}T00:00:00Z`).getUTCDay() || 7;
}

export function defaultWeek(period, now = new Date()) {
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const date = today < period.start_date ? period.start_date : today > period.end_date ? period.end_date : today;
  return addDays(date, 1 - weekday(date));
}

export function validatePreferences(payload, period) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).some((key) => !["expected_revision", "busy_weekdays", "date_overrides"].includes(key))) {
    throw planningError("Dữ liệu lịch bận không hợp lệ; không được thay người hoặc kỳ trong nội dung yêu cầu.");
  }
  if (!Number.isSafeInteger(payload.expected_revision) || payload.expected_revision < 0 || payload.expected_revision > 2147483646) {
    throw planningError("Phiên bản lịch bận không hợp lệ. Vui lòng tải lại.");
  }
  if (!Array.isArray(payload.busy_weekdays) || payload.busy_weekdays.length > 7 ||
      payload.busy_weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw planningError("Ngày bận thường lệ phải là danh sách các thứ hợp lệ.");
  }
  const overrides = payload.date_overrides;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides) || Object.keys(overrides).length > 370) {
    throw planningError("Ngoại lệ lịch bận không hợp lệ (tối đa 370 ngày).");
  }
  for (const [date, state] of Object.entries(overrides)) {
    if (!isDate(date) || date < period.start_date || date > period.end_date || !["busy", "available"].includes(state)) {
      throw planningError("Ngày ngoại lệ phải nằm trong kỳ và có trạng thái Bận hoặc Rảnh.");
    }
  }
  return {
    expected_revision: payload.expected_revision,
    busy_weekdays: [...new Set(payload.busy_weekdays)].sort((a, b) => a - b),
    date_overrides: Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))
  };
}

export function isAvailable(date, preferences) {
  if (!SCHEDULE_RULES.playing_weekdays.includes(weekday(date))) return false;
  const override = preferences?.date_overrides?.[date];
  if (override) return override === "available";
  return !(preferences?.busy_weekdays || []).includes(weekday(date));
}

// Exact bipartite max-flow feasibility check. It does NOT choose or publish a roster.
// Total capacity alone misses cases where many members are only free on the same days.
export function analyzeWeek(period, members, preferences, weekStart) {
  if (!isDate(weekStart) || weekday(weekStart) !== 1) throw planningError("Ngày đầu tuần phải là thứ Hai hợp lệ.");
  const weekEnd = addDays(weekStart, 6);
  if (weekEnd < period.start_date || weekStart > period.end_date) throw planningError("Tuần được chọn không giao với kỳ này.");
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter((date) => date >= period.start_date && date <= period.end_date && SCHEDULE_RULES.playing_weekdays.includes(weekday(date)));
  const byPerson = new Map(preferences.map((row) => [row.person_id, row]));
  const source = 0;
  const sink = 1 + members.length + dates.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  function edge(from, to, capacity) {
    graph[from].push({ to, capacity, reverse: graph[to].length });
    graph[to].push({ to: from, capacity: 0, reverse: graph[from].length - 1 });
  }
  const availability = members.map((member, index) => {
    const availableDates = dates.filter((date) => isAvailable(date, byPerson.get(member.id)));
    edge(source, index + 1, SCHEDULE_RULES.fixed_sessions_per_week);
    dates.forEach((date, day) => {
      if (availableDates.includes(date)) edge(index + 1, members.length + day + 1, 1);
    });
    return { person_id: member.id, available_dates: availableDates };
  });
  dates.forEach((date, day) => edge(members.length + day + 1, sink, SCHEDULE_RULES.capacity));
  let maxAssignable = 0;
  for (;;) {
    const parent = Array(graph.length).fill(null);
    const queue = [source];
    parent[source] = [-1, -1];
    for (let i = 0; i < queue.length && !parent[sink]; i++) {
      const from = queue[i];
      graph[from].forEach((link, index) => {
        if (link.capacity > 0 && !parent[link.to]) {
          parent[link.to] = [from, index];
          queue.push(link.to);
        }
      });
    }
    if (!parent[sink]) break;
    let amount = Infinity;
    for (let node = sink; node !== source; node = parent[node][0]) {
      const [from, index] = parent[node];
      amount = Math.min(amount, graph[from][index].capacity);
    }
    for (let node = sink; node !== source; node = parent[node][0]) {
      const [from, index] = parent[node];
      const link = graph[from][index];
      link.capacity -= amount;
      graph[node][link.reverse].capacity += amount;
    }
    maxAssignable += amount;
  }
  const required = members.length * SCHEDULE_RULES.fixed_sessions_per_week;
  const capacity = dates.length * SCHEDULE_RULES.capacity;
  return {
    week_start: weekStart, week_end: weekEnd, dates,
    member_count: members.length, required_slots: required, capacity_slots: capacity,
    max_assignable_slots: maxAssignable, shortfall: required - maxAssignable,
    possible: required === maxAssignable,
    partial_week: weekStart < period.start_date || weekEnd > period.end_date,
    // These are free slots only if ALL four-session quotas can first be met.
    extra_slots: required === maxAssignable ? capacity - required : 0,
    availability
  };
}
