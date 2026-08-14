import { useRef, useState, useMemo } from 'react'
import { api } from '../../../api/client'
import { supabase } from '../../../lib/supabase'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SearchBox, SimpleTable, StatusBadge, filterRows } from '../../../components/common'
import { emptyPerson } from '../../../constants/appConstants'
import { initials } from '../../../utils/appUtils'
import MembersPanel from './MembersPanel'

export function PeoplePanel({ people, submit, role }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingPerson, setEditingPerson] = useState(null)
  const [deletingPerson, setDeletingPerson] = useState(null)
  const [query, setQuery] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  const [searchResetKey, setSearchResetKey] = useState(0)

  const attendanceCounts = useMemo(() => ({
    all: people.length,
    fixed: people.filter((person) => person.attendance_type === 'fixed').length,
    guest: people.filter((person) => (person.attendance_type || 'guest') === 'guest').length,
  }), [people])

  const filtered = useMemo(() => {
    const searched = filterRows(people, query, ['full_name', 'phone', 'email', 'note', 'nickname'])
    const visible = searched.filter((person) => {
      const attendanceType = person.attendance_type || 'guest'
      const status = person.status || 'active'
      return (attendanceFilter === 'all' || attendanceType === attendanceFilter)
        && (statusFilter === 'all' || status === statusFilter)
    })

    return [...visible].sort((left, right) => comparePeople(left, right, sortBy))
  }, [attendanceFilter, people, query, sortBy, statusFilter])

  const hasActiveFilters = Boolean(query)
    || attendanceFilter !== 'all'
    || statusFilter !== 'all'
    || sortBy !== 'name-asc'

  function resetControls() {
    setQuery('')
    setSearchResetKey((current) => current + 1)
    setAttendanceFilter('all')
    setStatusFilter('all')
    setSortBy('name-asc')
  }

  return (
    <>
      {role === 'owner' && <MembersPanel role={role} />}

      <section className="grid one">
        <Panel
          title="Danh sách người"
          action={<button onClick={() => setShowAdd(true)}>+ Thêm người</button>}
        >
          <div className="people-controls">
            <div className="people-control-grid">
              <SearchBox key={searchResetKey} value={query} onChange={setQuery} placeholder="Tìm theo tên, SĐT, email..." />
              <label className="people-control-field">Trạng thái
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="pending">Đang chờ duyệt</option>
                  <option value="inactive">Đã nghỉ</option>
                </select>
              </label>
              <label className="people-control-field">Sắp xếp
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="name-asc">Tên A đến Z</option>
                  <option value="name-desc">Tên Z đến A</option>
                  <option value="newest">Tham gia mới nhất</option>
                  <option value="oldest">Tham gia lâu nhất</option>
                  <option value="attendance">Cố định trước</option>
                </select>
              </label>
            </div>

            <div className="people-filter-tabs" role="group" aria-label="Lọc theo hình thức chơi">
              {[
                ['all', 'Tất cả'],
                ['fixed', 'Cố định'],
                ['guest', 'Vãng lai'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={attendanceFilter === value ? 'active' : ''}
                  aria-pressed={attendanceFilter === value}
                  onClick={() => setAttendanceFilter(value)}
                >
                  {label} <span>{attendanceCounts[value]}</span>
                </button>
              ))}
            </div>

            <div className="people-results-line">
              <span>Đang hiển thị <strong>{filtered.length}</strong>/{people.length} người</span>
              {hasActiveFilters && (
                <button type="button" onClick={resetControls}>Đặt lại bộ lọc</button>
              )}
            </div>
          </div>
          <SimpleTable
            rows={filtered}
            columns={[
              ['full_name', 'Họ tên'],
              ['phone', 'Điện thoại'],
              ['email', 'Thư điện tử'],
              ['attendance_type', 'Hình thức chơi', (v) => <StatusBadge value={v} />],
              ['status', 'Trạng thái', (v) => <StatusBadge value={v} />],
              ['note', 'Ghi chú'],
            ]}
            actions={(person) => (
              <ActionGroup>
                <button onClick={() => setEditingPerson(person)}>Sửa</button>
                <button className="danger" onClick={() => setDeletingPerson(person)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>

      {showAdd && (
        <PersonAddModal
          onClose={() => setShowAdd(false)}
          onSubmit={(payload) => {
            submit(() => api.people.create(payload), 'Đã thêm người mới.')
            setShowAdd(false)
          }}
        />
      )}

      {editingPerson && (
        <PersonEditModal
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
          onSubmit={(payload, avatarFile, newPassword) => {
            const id = editingPerson.id
            submit(async () => {
              let avatar_url = payload.avatar_url
              if (avatarFile) {
                const ext = avatarFile.name.split('.').pop()
                const path = `${id}.${ext}`
                const { error: upErr } = await supabase.storage
                  .from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
                if (upErr) throw new Error(upErr.message)
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
                avatar_url = urlData.publicUrl
              }
              await api.people.update(id, { ...payload, avatar_url })
              if (newPassword) await api.people.updatePassword(id, newPassword)
            }, 'Đã cập nhật người.')
            setEditingPerson(null)
          }}
        />
      )}

      {deletingPerson && (
        <ConfirmModal
          title="Xóa người chơi"
          message={`Bạn chắc chắn muốn xóa ${deletingPerson.full_name || 'người chơi này'}?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeletingPerson(null)}
          onConfirm={() => {
            submit(() => api.people.remove(deletingPerson.id), 'Đã xóa người.')
            setDeletingPerson(null)
          }}
        />
      )}
    </>
  )
}

function PersonAddModal({ onClose, onSubmit }) {
  const [draft, setDraft] = useState({ ...emptyPerson })
  function update(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  return (
    <Modal title="Thêm người" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit(draft) }}>
        <Input label="Họ tên" value={draft.full_name} onChange={(v) => update('full_name', v)} required />
        <Input label="Điện thoại" value={draft.phone} onChange={(v) => update('phone', v)} />
        <Input label="Thư điện tử" value={draft.email} onChange={(v) => update('email', v)} />
        <label>Hình thức chơi
          <select value={draft.attendance_type} onChange={(e) => update('attendance_type', e.target.value)}>
            <option value="fixed">Đánh cố định</option>
            <option value="guest">Đánh vãng lai</option>
          </select>
        </label>
        <Input label="Ghi chú" value={draft.note} onChange={(v) => update('note', v)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Thêm người</button>
        </footer>
      </form>
    </Modal>
  )
}

function PersonEditModal({ person, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    full_name: person.full_name || '',
    phone: person.phone || '',
    email: person.email || '',
    attendance_type: person.attendance_type || 'guest',
    status: person.status || 'active',
    note: person.note || '',
    avatar_url: person.avatar_url || '',
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(person.avatar_url || '')
  const [newPassword, setNewPassword] = useState('')
  const fileRef = useRef()

  function update(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Ảnh không được vượt quá 2MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  return (
    <Modal title="Sửa người chơi" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        const payload = person.status === 'pending'
          ? Object.fromEntries(Object.entries(draft).filter(([key]) => key !== 'status'))
          : draft
        onSubmit(payload, avatarFile || null, newPassword || null)
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div
            onClick={() => fileRef.current?.click()}
            title="Nhấn để đổi ảnh"
            style={{ cursor: 'pointer', width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2, #333)' }}
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '1.4rem' }}>{initials(draft.full_name)}</span>}
          </div>
          <small className="muted" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>Nhấn để đổi ảnh đại diện</small>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        <Input label="Họ tên" value={draft.full_name} onChange={(v) => update('full_name', v)} required />
        <Input label="Điện thoại" value={draft.phone} onChange={(v) => update('phone', v)} />
        <Input label="Thư điện tử" value={draft.email} onChange={(v) => update('email', v)} />
        <label>Hình thức chơi
          <select value={draft.attendance_type} onChange={(e) => update('attendance_type', e.target.value)}>
            <option value="fixed">Đánh cố định</option>
            <option value="guest">Đánh vãng lai</option>
          </select>
        </label>
        {person.status === 'pending' ? (
          <p className="muted">Tài khoản đang chờ trưởng nhóm duyệt trong mục Thành viên.</p>
        ) : (
          <label>Trạng thái
            <select value={draft.status} onChange={(e) => update('status', e.target.value)}>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã nghỉ</option>
            </select>
          </label>
        )}
        <Input label="Ghi chú" value={draft.note} onChange={(v) => update('note', v)} />

        <label>
          Mật khẩu mới <small className="muted">(để trống nếu không đổi)</small>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete="new-password" />
        </label>

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

export default PeoplePanel

function comparePeople(left, right, sortBy) {
  const leftName = left.full_name || left.nickname || ''
  const rightName = right.full_name || right.nickname || ''
  const byName = leftName.localeCompare(rightName, 'vi', { sensitivity: 'base' })

  if (sortBy === 'name-desc') return -byName
  if (sortBy === 'newest') return personTime(right) - personTime(left) || byName
  if (sortBy === 'oldest') return personTime(left) - personTime(right) || byName
  if (sortBy === 'attendance') {
    const leftAttendance = left.attendance_type === 'fixed' ? 0 : 1
    const rightAttendance = right.attendance_type === 'fixed' ? 0 : 1
    return leftAttendance - rightAttendance || byName
  }
  return byName
}

function personTime(person) {
  const value = person.joined_at || person.created_at
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}
