import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path) {
  return readFileSync(path, 'utf8')
}

test('admin debt view loads the group ledger and creates one payment for all debts', () => {
  const api = read('src/api/client.js')
  const hook = read('src/features/admin/useAdminPortalData.js')
  const panel = read('src/features/admin/panels/DebtsPanel.jsx')
  const finance = read('src/components/finance.jsx')

  assert.match(api, /ledgerByPeriod/)
  assert.match(hook, /api\.debts\.ledgerByPeriod/)
  assert.match(hook, /api\.payments\.createForPerson/)
  assert.doesNotMatch(hook, /api\.payments\.createForPersonPeriod/)
  assert.match(panel, /Thanh toán tất cả/)
  assert.match(finance, /Kỳ phát sinh/)
})
