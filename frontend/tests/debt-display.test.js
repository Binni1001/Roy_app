import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDebtDescription } from '../src/utils/appUtils.js'

test('debt descriptions hide internal attendance ids and format the play date', () => {
  const text = formatDebtDescription({
    debt_type: 'guest_fee',
    description: 'Tien khach vang lai Thang 8 ngay 2026-08-25 [guest_attendance:abc-123]',
  })

  assert.equal(text, 'Phí khách vãng lai ngày 25/8/2026 - Thang 8')
  assert.doesNotMatch(text, /guest_attendance/)
})

test('debt descriptions provide readable legacy and fallback labels', () => {
  assert.equal(
    formatDebtDescription({ debt_type: 'monthly_fee', description: 'Tien co dinh Thang 8' }),
    'Phí thành viên cố định - Thang 8',
  )
  assert.equal(
    formatDebtDescription({ debt_type: 'shuttle_extra', description: 'Tien cau phai dong them cuoi ky' }),
    'Tiền cầu đóng thêm cuối kỳ',
  )
  assert.equal(formatDebtDescription({ debt_type: 'other' }), 'Khác')
})
