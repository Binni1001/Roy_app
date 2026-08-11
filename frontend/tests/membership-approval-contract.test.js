import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('pending group membership blocks the user before onboarding', () => {
  const app = readFileSync('src/App.jsx', 'utf8')
  const pendingCheck = app.indexOf("membershipStatus === 'pending'")
  const noActiveGroupCheck = app.indexOf('!person.active_group_id', pendingCheck)

  assert.ok(pendingCheck >= 0)
  assert.ok(noActiveGroupCheck > pendingCheck)
  assert.match(app, /person\.membership_status \|\| person\.status/)
})

test('a pending person cannot be activated from the generic edit form', () => {
  const panel = readFileSync('src/features/admin/panels/PeoplePanel.jsx', 'utf8')

  assert.match(panel, /person\.status === 'pending'/)
  assert.match(panel, /filter\(\(\[key\]\) => key !== 'status'\)/)
  assert.match(panel, /chờ trưởng nhóm duyệt trong mục Thành viên/)
})
