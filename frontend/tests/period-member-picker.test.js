import test from 'node:test'
import assert from 'node:assert/strict'
import { hasActiveGroupMembership } from '../src/utils/groupMembership.js'

const G1 = 'g1-uuid', G2 = 'g2-uuid'

test('only an active membership in the period group qualifies', () => {
  const person = { id: 'p', person_groups: [{ group_id: G1, status: 'active' }] }
  assert.equal(hasActiveGroupMembership(person, G1), true)
  assert.equal(hasActiveGroupMembership(person, G2), false)
})

test('pending or inactive memberships do not qualify', () => {
  const person = { id: 'p', person_groups: [{ group_id: G1, status: 'pending' }, { group_id: G1, status: 'inactive' }] }
  assert.equal(hasActiveGroupMembership(person, G1), false)
})

test('legacy group links alone do not qualify, because the backend ignores them', () => {
  const person = { id: 'p', group_id: G1, active_group_id: G1, person_groups: [] }
  assert.equal(hasActiveGroupMembership(person, G1), false)
  assert.equal(hasActiveGroupMembership(person, null), false)
})
