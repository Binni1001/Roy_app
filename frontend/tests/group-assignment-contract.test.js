import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('owner can assign groups and forms do not close before a successful save', () => {
  const panel = readFileSync('src/features/admin/panels/DashboardPanel.jsx', 'utf8')
  const modal = readFileSync('src/features/admin/panels/AdminGroupAssignment.jsx', 'utf8')
  assert.match(panel, /role === 'owner'/)
  assert.match(panel, /Phân công nhóm/)
  assert.match(modal, /await submit\(/)
  assert.match(modal, /if \(result\) onClose\(\)/)
  assert.match(modal, /disabled=\{loading \|\| saving \|\| Boolean\(error\)\}/)
})

test('scoped admin sees explicit rollout notice instead of a fake zero financial dashboard', () => {
  const content = readFileSync('src/features/admin/AdminContent.jsx', 'utf8')
  const people = readFileSync('src/features/admin/panels/PeoplePanel.jsx', 'utf8')
  assert.match(content, /role === 'admin' && !\['people', 'periods', 'sessions'\]\.includes\(activeTab\)/)
  assert.match(content, /canManageMembers=\{role === 'owner'\}/)
  assert.match(people, /person\.can_manage_profile === true/)
  assert.match(people, /chỉ owner được đổi/)
})
