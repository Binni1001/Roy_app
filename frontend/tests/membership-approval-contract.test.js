import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('pending group membership blocks the user before onboarding', () => {
  const app = readFileSync('src/App.jsx', 'utf8')
  const pendingCheck = app.indexOf("membershipStatus === 'pending'")
  const groupsFeatureCheck = app.indexOf('if (GROUPS_ENABLED)', pendingCheck)

  assert.ok(pendingCheck >= 0)
  assert.ok(groupsFeatureCheck > pendingCheck)
  assert.match(app, /person\.membership_status \|\| person\.status/)
})

test('a pending person cannot be activated from the generic edit form', () => {
  const panel = readFileSync('src/features/admin/panels/PeoplePanel.jsx', 'utf8')

  assert.match(panel, /person\.status === 'pending'/)
  assert.match(panel, /filter\(\(\[key\]\) => key !== 'status'\)/)
  assert.match(panel, /chờ trưởng nhóm duyệt trong mục Thành viên/)
})

test('the owner sees pending approvals inside the people panel', () => {
  const content = readFileSync('src/features/admin/AdminContent.jsx', 'utf8')
  const panel = readFileSync('src/features/admin/panels/PeoplePanel.jsx', 'utf8')

  assert.match(content, /<PeoplePanel[\s\S]*role=\{role\}/)
  assert.match(panel, /role === 'owner' && <MembersPanel role=\{role\}/)
})
