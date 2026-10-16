import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path) {
  return readFileSync(path, 'utf8')
}

test('admin can open the edit form for a completed non-voided PK match', () => {
  const card = read('src/features/admin/panels/pk/AdminMatchCard.jsx')
  const modal = read('src/features/admin/panels/pk/PkEditModal.jsx')

  assert.match(card, /!isVoided && <button onClick=\{\(\) => onEdit\(m\)\}>Sửa trận<\/button>/)
  assert.match(modal, /Sửa tỷ số riêng/)
  assert.match(modal, /Lưu và cập nhật xếp hạng/)
  assert.match(modal, /match\.status === 'completed'/)
});
