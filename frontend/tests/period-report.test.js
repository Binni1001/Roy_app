import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPeriodReportHtml, headline, reportFileName, summarizePeriod } from '../src/utils/periodReport.js'

const person = (id, name) => ({ id, full_name: name })
const data = {
  period: { name: 'Tháng 11', start_date: '2026-11-01', end_date: '2026-11-30' },
  members: [1, 2, 3],
  debts: [
    { person: person('a', 'An'), status: 'paid', amount: 100000 },
    { person: person('b', 'Bình'), status: 'unpaid', amount: 80000 },
    { person: person('b', 'Bình'), status: 'unpaid', amount: 20000 },
    { person: person('c', 'Chi'), status: 'paid', amount: 100000 },
    { person: person('d', 'Dũng'), status: 'cancelled', amount: 999999 }
  ],
  fund: [
    { transaction_type: 'income', amount: 200000, description: 'Thu tien - monthly_fee', created_at: '2026-11-02' },
    { transaction_type: 'expense', amount: 50000, description: 'Mua cầu', created_at: '2026-11-03' }
  ],
  shuttleExpenses: [{ buy_type: 'tube', tube_count: 2, shuttle_per_tube: 12, total_amount: 50000, buy_date: '2026-11-03' }]
}

test('summary ignores cancelled debts and merges a person across several debts', () => {
  const s = summarizePeriod(data)
  assert.equal(s.totalDebt, 300000)
  assert.equal(s.paidAmt, 200000)
  assert.equal(s.unpaidAmt, 100000)
  assert.equal(s.paidPercent, 67)
  assert.deepEqual(s.debtors.map((d) => [d.name, d.unpaid]), [['Bình', 100000]])
  assert.equal(s.paidPeopleCount, 2)
  assert.equal(s.balance, 150000)
  assert.equal(s.shuttle.pieces, 24)
})

test('people with the same name are not merged', () => {
  const s = summarizePeriod({
    debts: [
      { person: person('x', 'Minh'), status: 'unpaid', amount: 10 },
      { person: person('y', 'Minh'), status: 'unpaid', amount: 20 }
    ]
  })
  assert.equal(s.debtors.length, 2)
})

test('headline states the situation in one plain sentence', () => {
  assert.match(headline(summarizePeriod(data)), /Còn 1 người chưa đóng/)
  assert.match(headline(summarizePeriod({ debts: [{ person: person('a', 'An'), status: 'paid', amount: 5 }] })), /đã đóng đủ/)
  assert.match(headline(summarizePeriod({})), /chưa có khoản công nợ/)
})

test('the report can hide names and only adds the appendix on request', () => {
  const withNames = buildPeriodReportHtml(data)
  assert.match(withNames, /Bình/)
  assert.doesNotMatch(withNames, /Phụ lục/)

  const anonymous = buildPeriodReportHtml(data, { showNames: false })
  assert.doesNotMatch(anonymous, /Bình/)
  assert.match(anonymous, /1 người chưa đóng/)

  const detailed = buildPeriodReportHtml(data, { includeDetails: true })
  assert.match(detailed, /Phụ lục 1/)
  assert.match(detailed, /Phụ lục 4/)
})

test('data coming from users or admins is escaped in the HTML', () => {
  const html = buildPeriodReportHtml({
    ...data,
    period: { name: '<img src=x onerror=alert(1)>' },
    debts: [{ person: person('z', '<script>alert(1)</script>'), status: 'unpaid', amount: 1 }],
    shuttleExpenses: [{ buy_type: 'single', single_count: 1, total_amount: 1, note: '"><svg onload=alert(1)>' }]
  }, { includeDetails: true })

  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.doesNotMatch(html, /<svg onload/)
  assert.match(html, /&lt;script&gt;/)
})

test('file name is safe and readable', () => {
  assert.equal(reportFileName({ name: 'Tháng 11/2026' }), 'Bao-cao-ky-Tháng-11-2026')
  assert.equal(reportFileName(null), 'Bao-cao-ky-bao-cao')
})
