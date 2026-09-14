import test from 'node:test'
import assert from 'node:assert/strict'
import { isActivityPerson } from '../src/utils/activityEligibility.js'

test('activity choices exclude managers and inactive people, not people named Admin', () => {
  assert.equal(isActivityPerson({ status: 'active', account_role: 'admin' }), false)
  assert.equal(isActivityPerson({ status: 'active', account_role: 'owner' }), false)
  assert.equal(isActivityPerson({ status: 'inactive', account_role: 'user' }), false)
  assert.equal(isActivityPerson({ status: 'pending' }), false)
  assert.equal(isActivityPerson({ status: 'active', activity_eligible: false }), false)
  assert.equal(isActivityPerson({ status: 'active', account_role: 'user', full_name: 'Admin' }), true)
  assert.equal(isActivityPerson({ status: 'active' }), true)
  assert.equal(isActivityPerson(null), false)
})
