import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('admin fund view shows every active member with credit, debt and net amount', () => {
  const panel = readFileSync('src/features/admin/panels/FundPanel.jsx', 'utf8')
  const client = readFileSync('src/api/client.js', 'utf8')

  assert.match(panel, /Tình trạng tài chính thành viên/)
  assert.match(panel, /person\.status === 'active'/)
  assert.match(panel, /debt\.status !== 'unpaid'/)
  assert.match(panel, /net: balance - debt/)
  assert.match(panel, /'Được nhận'/)
  assert.match(panel, /'Công nợ'/)
  assert.match(panel, /'Số ròng'/)
  assert.match(panel, /api\.balances\.offsetAll\(\)/)
  assert.match(client, /\/api\/balance-offsets\/person\/\$\{personId\}/)
  assert.match(client, /\/api\/balance-offsets\/all/)
})
