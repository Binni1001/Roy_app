import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('attendance UI keeps finance-changing controls owner-only and shows a retryable load failure', () => {
  const content = readFileSync('src/features/admin/AdminContent.jsx', 'utf8')
  const panel = readFileSync('src/features/admin/panels/SessionsPanel.jsx', 'utf8')
  assert.match(content, /canManageGuests=\{role === 'owner'\}/)
  assert.match(content, /canDeleteSessions=\{role === 'owner'\}/)
  assert.match(panel, /onDelete=\{canDeleteSessions \? setDeletingSession : undefined\}/)
  assert.match(panel, /guestError \? <div role="alert">/)
  assert.match(panel, /if \(result\) setShowAddSession\(false\)/)
  assert.match(panel, /if \(result\) setEditingSession\(null\)/)
})

test('period loads reject stale responses and do not hide required API failures as empty arrays', () => {
  const hook = readFileSync('src/features/admin/useAdminPortalData.js', 'utf8')
  assert.match(hook, /request !== periodRequestRef.current/)
  assert.match(hook, /periodError: errorText\(error\)/)
  for (const name of ['periodMembers', 'sessions', 'debts', 'balances', 'fund']) {
    assert.doesNotMatch(hook, new RegExp(`api\\.${name}[^\\n]+catch\\(\\(\\) => \\[\\]\\)`))
  }
})
