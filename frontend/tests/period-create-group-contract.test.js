import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('period creation keeps the selected group and closes only after success', () => {
  const panel = readFileSync('src/features/admin/panels/PeriodsPanel.jsx', 'utf8')

  assert.match(panel, /currentGroupId/)
  assert.match(panel, /group_id: currentGroupId/)
  assert.match(panel, /const result = await submit/)
  assert.match(panel, /if \(!result\) return/)
  assert.match(panel, /'global'/)
})
