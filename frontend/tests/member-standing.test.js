import test from 'node:test'
import assert from 'node:assert/strict'
import { computeMemberStanding } from '../src/utils/memberStanding.js'
import { buildPeriodReportHtml } from '../src/utils/periodReport.js'

const person = (id, name, extra = {}) => ({ id, full_name: name, status: 'active', ...extra })
const unpaid = (id, name, amount) => ({ person_id: id, person: person(id, name), status: 'unpaid', amount })

test('net is credit minus unpaid debt; paid and cancelled debts do not count', () => {
  const s = computeMemberStanding({
    debts: [
      unpaid('a', 'An', 100000),
      { ...unpaid('a', 'An', 50000), status: 'paid' },
      { ...unpaid('b', 'Bình', 70000), status: 'cancelled' },
      unpaid('c', 'Chi', 30000)
    ],
    balances: [
      { person_id: 'b', person: person('b', 'Bình'), balance: 40000 },
      { person_id: 'c', person: person('c', 'Chi'), balance: 30000 }
    ]
  })

  assert.deepEqual(s.negative.map((r) => [r.name, r.net]), [['An', -100000]])
  assert.deepEqual(s.positive.map((r) => [r.name, r.net]), [['Bình', 40000]])
  assert.equal(s.evenCount, 1)
  assert.equal(s.totalPositive, 40000)
  assert.equal(s.totalNegative, -100000)
})

test('lists are ordered by size and one person with several rows is merged', () => {
  const s = computeMemberStanding({
    debts: [unpaid('a', 'An', 10), unpaid('a', 'An', 20), unpaid('b', 'Bình', 100)]
  })
  assert.deepEqual(s.negative.map((r) => [r.name, r.net]), [['Bình', -100], ['An', -30]])
})

test('inactive people and managers are left out when the people list is known', () => {
  const people = [person('a', 'An'), person('b', 'Bình', { status: 'inactive' }), person('c', 'Chi', { account_role: 'admin' })]
  const s = computeMemberStanding({
    people,
    debts: [unpaid('a', 'An', 10), unpaid('b', 'Bình', 10), unpaid('c', 'Chi', 10)]
  })
  assert.deepEqual(s.negative.map((r) => r.name), ['An'])
})

test('the report lists who is ahead, and can hide names', () => {
  const data = {
    period: { name: 'T11' },
    debts: [unpaid('a', 'An', 100000)],
    balances: [{ person_id: 'b', person: person('b', 'Bình'), balance: 50000 }]
  }
  const named = buildPeriodReportHtml(data)
  assert.match(named, /Ai đang dương/)
  assert.match(named, /Bình/)

  const anonymous = buildPeriodReportHtml(data, { showNames: false })
  assert.match(anonymous, /1 người đang dương/)
  assert.doesNotMatch(anonymous, /Bình/)

  assert.doesNotMatch(buildPeriodReportHtml({ ...data, balances: [] }), /Ai đang dương/)
})
