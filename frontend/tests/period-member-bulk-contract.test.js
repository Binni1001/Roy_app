import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('period member modal supports safe multi-selection and bulk enrollment', () => {
  const panel = readFileSync('src/features/admin/panels/PeriodsPanel.jsx', 'utf8')
  const client = readFileSync('src/api/client.js', 'utf8')
  const content = readFileSync('src/features/admin/AdminContent.jsx', 'utf8')

  assert.match(client, /createBulk/)
  assert.match(client, /\/api\/period-members\/bulk/)
  assert.match(panel, /person_ids: personIds/)
  assert.match(panel, /type="checkbox"/)
  assert.match(panel, /Chọn tất cả kết quả/)
  assert.match(panel, /person\.status === 'active'/)
  assert.match(panel, /!existingIds\.has\(person\.id\)/)
  assert.match(panel, /disabled=\{submitting \|\| selectedIds\.length === 0\}/)
  assert.match(content, /<PeriodsPanel[\s\S]*submit=\{submit\}/)
})
