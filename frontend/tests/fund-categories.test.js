import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, expenseCategoryKey, groupFund, incomeCategoryKey
} from '../src/utils/fundCategories.js'
import { buildPeriodReportHtml, summarizePeriod } from '../src/utils/periodReport.js'

const debts = [
  { id: 'd1', debt_type: 'monthly_fee', description: 'Tien co dinh Mùa 5' },
  { id: 'd2', debt_type: 'guest_fee', description: 'Khach choi le' },
  { id: 'd3', debt_type: 'shuttle_extra', description: 'Tien cau phai dong them cuoi ky' }
]
const byId = new Map(debts.map((d) => [d.id, d]))
const income = (extra) => ({ transaction_type: 'income', amount: 100000, ...extra })

test('income is classified by the paid debt type, not by guessing from the text', () => {
  assert.equal(incomeCategoryKey(income({ debt_id: 'd1', description: 'Thu tien - Tien co dinh Mùa 5' }), byId), 'fixed')
  assert.equal(incomeCategoryKey(income({ debt_id: 'd2', description: 'bất kỳ' }), byId), 'guest')
  assert.equal(incomeCategoryKey(income({ debt_id: 'd3', description: 'bất kỳ' }), byId), 'closeout')
})

test('unaccented "Tien co dinh" no longer falls into "other income"', () => {
  assert.equal(incomeCategoryKey(income({ description: 'Thu tien - Tien co dinh Mùa 5' })), 'fixed')
  assert.equal(incomeCategoryKey(income({ description: 'Số dư mang sang kỳ trước' })), 'carry')
  assert.equal(incomeCategoryKey(income({ description: 'Nộp thêm cho quỹ' })), 'deposit')
  assert.equal(incomeCategoryKey({ transaction_type: 'adjustment', amount: 1, description: 'sửa số' }), 'adjustment')
})

test('"chuyển sang" is not mistaken for a court fee', () => {
  assert.equal(expenseCategoryKey({ transaction_type: 'expense', description: 'Kết chuyển sang kỳ sau' }), 'carry')
  assert.equal(expenseCategoryKey({ transaction_type: 'expense', description: 'Trả sang tên' }), 'other')
  assert.equal(expenseCategoryKey({ transaction_type: 'refund', description: 'x' }), 'refund')
})

test('groups show how many people or entries each total is made of', () => {
  const groups = groupFund(
    [
      income({ debt_id: 'd1', person_id: 'a', amount: 300000 }),
      income({ debt_id: 'd1', person_id: 'b', amount: 300000 }),
      income({ debt_id: 'd2', person_id: 'a', amount: 50000 }),
      income({ debt_id: 'd2', person_id: 'a', amount: 60000 })
    ],
    (f) => incomeCategoryKey(f, byId),
    INCOME_CATEGORIES
  )
  assert.deepEqual(groups.map((g) => [g.key, g.amount, g.countText]), [
    ['fixed', 600000, '2 người'],
    ['guest', 110000, '2 khoản']
  ])
  assert.equal(groupFund([], () => 'other', EXPENSE_CATEGORIES).length, 0)
})

test('the report names each income source and explains it', () => {
  const data = {
    period: { name: 'Mùa 5' },
    debts: debts.map((d, i) => ({ ...d, person_id: `p${i}`, person: { id: `p${i}`, full_name: `P${i}` }, status: 'paid', amount: 1 })),
    fund: [
      income({ debt_id: 'd1', person_id: 'p1', amount: 2700000, description: 'Thu tien - Tien co dinh Mùa 5' }),
      income({ debt_id: 'd2', person_id: 'p2', amount: 1660000 }),
      income({ debt_id: 'd3', person_id: 'p3', amount: 406364 })
    ]
  }
  const s = summarizePeriod(data)
  assert.deepEqual(s.incomeGroups.map((g) => g.key), ['fixed', 'guest', 'closeout'])

  const html = buildPeriodReportHtml(data)
  assert.match(html, /Tiền cố định thành viên đóng/)
  assert.match(html, /Phần đóng cố định của mỗi thành viên/)
  assert.doesNotMatch(html, /Thu khác/)
})
