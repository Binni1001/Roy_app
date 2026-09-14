import test from 'node:test'
import assert from 'node:assert/strict'
import { getSessionRole, canOpenAdmin } from '../src/utils/appUtils.js'

test('forged user metadata never opens the admin portal', () => {
  for (const role of ['admin', 'owner']) {
    const resolved = getSessionRole({ user: { user_metadata: { role } } })
    assert.equal(resolved, 'user')
    assert.equal(canOpenAdmin(resolved), false)
  }
})

test('trusted roles open the right portal and missing/invalid roles default to user', () => {
  for (const role of ['admin', 'owner', 'user', undefined, null, '', 'ADMIN', ['owner']]) {
    const resolved = getSessionRole({ user: { app_metadata: { role }, user_metadata: { role: 'owner' } } })
    assert.equal(canOpenAdmin(resolved), role === 'admin' || role === 'owner')
  }
  assert.equal(getSessionRole(null), 'user')
})
