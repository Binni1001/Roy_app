import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { formatPlanningDate, preferencePayload, weekStartFor, WEEKDAYS } from '../src/features/session-planning/planningUtils.js'

test('week selection is timezone-independent, with Sunday mapped to the preceding Monday', () => {
  assert.equal(weekStartFor('2026-09-27'), '2026-09-21')
  assert.equal(weekStartFor('2026-09-28'), '2026-09-28')
  assert.equal(weekStartFor('2026-02-30'), '')
  assert.equal(weekStartFor(''), '')
  assert.equal(WEEKDAYS.length, 7)
  assert.equal(formatPlanningDate('2026-09-23'), '23/9/2026')
})

test('save retains revision, normalizes days and never trusts client-supplied scope or roles', () => {
  const overrides = { '2026-09-23': 'busy' }
  const payload = preferencePayload({ revision: 7, person_id: 'ignored', role: 'owner' }, [5, 1], overrides)
  assert.deepEqual(payload, { expected_revision: 7, busy_weekdays: [1, 5], date_overrides: overrides })
  assert.notEqual(payload.date_overrides, overrides)
})

test('planning UI is wired for admin and self, isolates requests and states migration is only stage one', async () => {
  const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
  const [panel, admin, user, portal, client] = await Promise.all([
    read('../src/features/session-planning/SessionPlanningPanel.jsx'), read('../src/features/admin/AdminContent.jsx'),
    read('../src/features/user/UserContent.jsx'), read('../src/features/user/UserPortal.jsx'), read('../src/api/client.js'),
  ])
  assert.match(panel, /result\?\.key !== requestKey/)
  assert.match(panel, /return \(\) => \{ active = false \}/)
  assert.match(panel, /mounted\.current/)
  assert.match(panel, /lock\.current/)
  assert.match(panel, /disabled=\{!canEdit \|\| saving\}/)
  assert.match(panel, /Chưa phân buổi, giữ chỗ, gửi thông báo hoặc tạo công nợ/)
  assert.match(admin, /SessionPlanningPanel key=\{selectedPeriodId\}/)
  assert.match(user, /SessionPlanningPanel key=\{selectedPeriodId\}/)
  assert.match(portal, /selectedPeriodId=\{selectedPeriodId\}/)
  assert.match(client, /api\/session-planning\/period/)
  assert.doesNotMatch(panel, /api\.(debts|guests|payments)\./)
})
