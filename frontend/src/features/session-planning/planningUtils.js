export const WEEKDAYS = [
  [1, 'Thứ Hai'], [2, 'Thứ Ba'], [3, 'Thứ Tư'],
  [4, 'Thứ Năm'], [5, 'Thứ Sáu'], [6, 'Thứ Bảy'], [7, 'Chủ nhật'],
]

export function formatPlanningDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export function weekStartFor(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return ''
  date.setUTCDate(date.getUTCDate() + 1 - (date.getUTCDay() || 7))
  return date.toISOString().slice(0, 10)
}

export function preferencePayload(preferences, busyDays, overrides) {
  return { expected_revision: preferences.revision,
    busy_weekdays: [...busyDays].sort((a, b) => a - b), date_overrides: { ...overrides } }
}

export function profilePayload(profile, level, partnerId) {
  return { expected_revision: profile.revision, level: level === '' ? null : Number(level),
    preferred_partner_id: partnerId || null }
}

export function previewPayload(inputs, assignments) {
  return { week_start: inputs.analysis.week_start, input_version: inputs.input_version,
    ...(assignments === undefined ? {} : { assignments: assignments.map(({ person_id, date }) => ({ person_id, date })) }) }
}

export function toggleDraftAssignment(assignments, personId, date, selected) {
  const remaining = assignments.filter((row) => row.person_id !== personId || row.date !== date)
  return selected ? [...remaining, { person_id: personId, date }] : remaining
}

// The shared API wraps Axios errors in Error.cause; don't lose stale-input codes.
export function planningErrorCode(error) {
  for (let depth = 0; error && depth < 5; depth++, error = error.cause) {
    const code = error.response?.data?.code || error.code
    if (typeof code === 'string') return code
  }
  return ''
}
