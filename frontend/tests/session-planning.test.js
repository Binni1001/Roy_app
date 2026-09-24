import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { formatPlanningDate, planningErrorCode, preferencePayload, previewPayload, profilePayload, toggleDraftAssignment, weekStartFor, WEEKDAYS } from '../src/features/session-planning/planningUtils.js'

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
  assert.match(panel, /Chưa công bố lịch, giữ chỗ, gửi thông báo hoặc tạo công nợ/)
  assert.match(admin, /SessionPlanningPanel key=\{selectedPeriodId\}/)
  assert.match(user, /SessionPlanningPanel key=\{selectedPeriodId\}/)
  assert.match(portal, /selectedPeriodId=\{selectedPeriodId\}/)
  assert.match(client, /api\/session-planning\/period/)
  assert.doesNotMatch(panel, /api\.(debts|guests|payments)\./)
})

test('profile payload preserves unknown level, revision and clears a removed partner explicitly', () => {
  assert.deepEqual(profilePayload({ revision: 2, role: 'owner' }, '', ''), { expected_revision: 2, level: null, preferred_partner_id: null })
  assert.deepEqual(profilePayload({ revision: 2 }, '3', 'person-b'), { expected_revision: 2, level: 3, preferred_partner_id: 'person-b' })
})

test('preview only sends whitelisted fields and empty manual draft is not automatic generation', () => {
  const inputs = { input_version: 'version', analysis: { week_start: '2026-09-07' }, private: 'ignored' }
  assert.deepEqual(previewPayload(inputs), { input_version: 'version', week_start: '2026-09-07' })
  assert.deepEqual(previewPayload(inputs, []), { input_version: 'version', week_start: '2026-09-07', assignments: [] })
  assert.deepEqual(previewPayload(inputs, [{ person_id: 'a', date: '2026-09-07', approved: true }]).assignments,
    [{ person_id: 'a', date: '2026-09-07' }])
})

test('manual toggles are immutable, unique and remove just the selected day', () => {
  const original = [{ person_id: 'a', date: '2026-09-07' }, { person_id: 'a', date: '2026-09-08' }]
  assert.equal(toggleDraftAssignment(original, 'a', '2026-09-07', true).length, 2)
  assert.deepEqual(toggleDraftAssignment(original, 'a', '2026-09-07', false), [original[1]])
  assert.equal(original.length, 2)
})

test('stale-input errors survive the shared API Error.cause wrapper, not just raw Axios errors', () => {
  const axios = { response: { data: { code: 'PLANNING_STALE_INPUT' } } }
  assert.equal(planningErrorCode(new Error('Reload', { cause: axios })), 'PLANNING_STALE_INPUT')
  assert.equal(planningErrorCode(axios), 'PLANNING_STALE_INPUT')
  assert.equal(planningErrorCode(null), '')
  const cyclic = {}; cyclic.cause = cyclic
  assert.equal(planningErrorCode(cyclic), '')
})

test('draft UI is admin-only, resets on scope/reload, rejects stale results and never claims publication', async () => {
  const panel = await readFile(new URL('../src/features/session-planning/SessionPlanningPanel.jsx', import.meta.url), 'utf8')
  const draft = await readFile(new URL('../src/features/session-planning/DraftPlanningPanel.jsx', import.meta.url), 'utf8')
  assert.match(panel, /data\.can_manage && <DraftPlanningPanel key=\{requestKey\}/)
  assert.match(draft, /key=\{`\$\{periodId\}:\$\{weekStart\}:\$\{reload\}`\}/)
  assert.match(draft, /return \(\) => \{ active = false \}/)
  assert.match(draft, /mounted\.current/)
  assert.match(draft, /PLANNING_STALE_INPUT/)
  assert.match(draft, /CHƯA LƯU \/ CHƯA CÔNG BỐ/)
  assert.doesNotMatch(draft, /api\.(debts|payments|guests|sessions)\./)
})
