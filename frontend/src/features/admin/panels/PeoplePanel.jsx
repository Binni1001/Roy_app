import { useRef, useState } from 'react'
import { api } from '../../../api/client'
import { supabase } from '../../../lib/supabase'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SimpleTable } from '../../../components/common'
import { emptyPerson } from '../../../constants/appConstants'
import { displayValue, initials } from '../../../utils/appUtils'

export function PeoplePanel({ people, form, setForm, submit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingPerson, setEditingPerson] = useState(null)
  const [deletingPerson, setDeletingPerson] = useState(null)

  return (
    <>
      <section className="grid one">
        <Panel
          title="Danh sách người"
          action={<button onClick={() => setShowAdd(true)}>+ Thêm người</button>}
        >
          <SimpleTable
            rows={people}
            columns={[
              ['full_name', 'Họ tên'],
              ['phone', 'Điện thoại'],
              ['email', 'Thư điện tử'],
              ['attendance_type', 'Hình thức chơi', displayValue],
              ['status', 'Trạng thái', (v) => v === 'inactive' ? 'Đã nghỉ' : 'Đang hoạt động'],
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
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit(draft, avatarFile || null, newPassword || null) }}>
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
        <label>Trạng thái
          <select value={draft.status} onChange={(e) => update('status', e.target.value)}>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã nghỉ</option>
          </select>
        </label>
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
