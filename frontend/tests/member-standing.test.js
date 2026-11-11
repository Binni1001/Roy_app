import test from 'node:test'
import assert from 'node:assert/strict'
import { computeMemberStanding, computeMonthStanding } from '../src/utils/memberStanding.js'
import { buildPeriodReportHtml, headline, summarizePeriod } from '../src/utils/periodReport.js'

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

const settlement = (settled = true) => ({
  settled,
  details: [
    { person_id: 'a', person: person('a', 'An'), paid_for_shuttles: 400000, shuttle_share: 100000, net_amount: 300000 },
    { person_id: 'b', person: person('b', 'Bình'), paid_for_shuttles: 0, shuttle_share: 102000, net_amount: -102000 },
    { person_id: 'c', person: person('c', 'Chi'), paid_for_shuttles: 0, shuttle_share: 102000, net_amount: -102000 },
    { person_id: 'd', person: person('d', 'Dũng'), paid_for_shuttles: 50000, shuttle_share: 50000, net_amount: 0 }
  ]
})
const closeoutDebt = (id, name, amount, status = 'unpaid') => ({ ...unpaid(id, name, amount), debt_type: 'shuttle_extra', status })

test('month standing comes from the shuttle settlement, even when nobody has a balance left', () => {
  const s = computeMonthStanding({
    settlement: settlement(),
    balances: [], // credit already refunded or offset
    debts: [closeoutDebt('b', 'Bình', 102000), closeoutDebt('c', 'Chi', 102000, 'paid')]
  })

  assert.equal(s.source, 'settlement')
  assert.equal(s.settled, true)
  assert.deepEqual(s.positive.map((r) => [r.name, r.net, r.paid, r.share]), [['An', 300000, 400000, 100000]])
  assert.deepEqual(s.negative.map((r) => [r.name, r.net, r.outstanding]), [['Bình', -102000, 102000], ['Chi', -102000, 0]])
  assert.equal(s.evenCount, 1)
  assert.equal(s.totalPositive, 300000)
  assert.equal(s.totalNegative, -204000)
})

test('an unsettled period shows a preview and an empty settlement falls back to balances', () => {
  assert.equal(computeMonthStanding({ settlement: settlement(false) }).settled, false)
  const fallback = computeMonthStanding({
    settlement: { error: 'Ky phai dang mo de chia cau' },
    balances: [{ person_id: 'b', person: person('b', 'Bình'), balance: 5 }]
  })
  assert.equal(fallback.source, 'balance')
  assert.deepEqual(fallback.positive.map((r) => r.name), ['Bình'])
})

test('closeout shuttle debts are carried to the next period, not "due this period"', () => {
  const data = {
    period: { name: 'Mùa 5' },
    debts: [
      { ...unpaid('a', 'An', 300000), status: 'paid', debt_type: 'monthly_fee' },
      { ...unpaid('b', 'Bình', 300000), status: 'paid', debt_type: 'monthly_fee' },
      closeoutDebt('b', 'Bình', 102000),
      closeoutDebt('c', 'Chi', 102000)
    ],
    settlementPreview: settlement()
  }
  const s = summarizePeriod(data)
  assert.equal(s.totalDebt, 600000)
  assert.equal(s.unpaidAmt, 0)
  assert.equal(s.debtors.length, 0)
  assert.equal(s.closeoutUnpaidAmt, 204000)
  assert.equal(s.closeoutUnpaidCount, 2)

  const text = headline(s)
  assert.match(text, /đã đóng đủ/)
  assert.match(text, /thu vào kỳ sau/)
  assert.doesNotMatch(text, /Còn \d+ người chưa đóng/)

  const html = buildPeriodReportHtml(data)
  assert.doesNotMatch(html, /Ai còn phải đóng/)
  assert.match(html, /Tiền cầu cuối kỳ: ai âm, ai dương/)
  assert.match(html, /\+300\.000đ/)
  assert.match(html, /thu vào kỳ sau/)

  const anonymous = buildPeriodReportHtml(data, { showNames: false })
  assert.doesNotMatch(anonymous, /Bình/)
})
