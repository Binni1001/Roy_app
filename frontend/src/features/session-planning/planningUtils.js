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
