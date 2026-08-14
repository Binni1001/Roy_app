import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('admin people list supports attendance and status filters with local sorting', () => {
  const panel = readFileSync('src/features/admin/panels/PeoplePanel.jsx', 'utf8')

  assert.match(panel, /attendanceFilter/)
  assert.match(panel, /statusFilter/)
  assert.match(panel, /sortBy/)
  assert.match(panel, /\['fixed', 'Cố định'\]/)
  assert.match(panel, /\['guest', 'Vãng lai'\]/)
  assert.match(panel, /Tên A đến Z/)
  assert.match(panel, /Tham gia mới nhất/)
  assert.match(panel, /comparePeople/)
  assert.match(panel, /Đặt lại bộ lọc/)
  assert.match(panel, /Đang hiển thị/)
})

test('resetting a people search also clears the visible search input', () => {
  const panel = readFileSync('src/features/admin/panels/PeoplePanel.jsx', 'utf8')
  const common = readFileSync('src/components/common.jsx', 'utf8')

  assert.match(panel, /setSearchResetKey\(\(current\) => current \+ 1\)/)
  assert.match(panel, /<SearchBox key=\{searchResetKey\}/)
  assert.match(common, /guest:\s+\{ label: 'Vãng lai'/)
})
