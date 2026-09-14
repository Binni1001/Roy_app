import { useEffect, useState } from 'react'
import { api } from '../../../api/client'
import { Modal } from '../../../components/common'

export default function AdminGroupAssignment({ user, onClose, submit }) {
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState(user.managed_group_ids || [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.adminUsers.groups().then((data) => { if (active) setGroups(data) })
      .catch(() => { if (active) setError('Không tải được nhóm. Hãy đóng và mở lại để thử lại.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function save(event) {
    event.preventDefault()
    if (loading || saving || error) return
    setSaving(true)
    try {
      const result = await submit(() => api.adminUsers.assignGroups(user.id, selected), 'Đã cập nhật nhóm được phân công.')
      if (result) onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Phân công nhóm — ${user.email}`} onClose={saving ? () => {} : onClose}>
      <form className="form" onSubmit={save}>
        <p>Admin chỉ quản lý các nhóm được owner chọn bên dưới. Không chọn nhóm nào sẽ thu hồi toàn bộ phạm vi quản lý nhóm.</p>
        <p className="muted">Đợt hiện tại mở Nhân sự và Kỳ quỹ cho admin. Các nghiệp vụ khác đang chờ hoàn tất kiểm tra cách ly nhóm; owner vẫn thao tác được.</p>
        {loading && <p>Đang tải nhóm…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && groups.length === 0 && <p>Chưa có nhóm nào.</p>}
        {groups.map((group) => (
          <label key={group.id}>
            <input type="checkbox" checked={selected.includes(group.id)} disabled={saving}
              onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, group.id] : ids.filter((id) => id !== group.id))} />
            {group.name}
          </label>
        ))}
        <footer className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>Hủy</button>
          <button type="submit" disabled={loading || saving || Boolean(error)}>{saving ? 'Đang lưu…' : 'Lưu phân công'}</button>
        </footer>
      </form>
    </Modal>
  )
}
