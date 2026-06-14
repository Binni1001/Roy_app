import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SimpleTable } from '../../../components/common'
import { emptyPerson } from '../../../constants/appConstants'
import { displayValue } from '../../../utils/appUtils'

export function PeoplePanel({ people, form, setForm, submit }) {
  const [editingPerson, setEditingPerson] = useState(null)
  const [deletingPerson, setDeletingPerson] = useState(null)

  return (
    <>
      <section className="grid two">
        <Panel title="Thêm người">
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              submit(() => api.people.create(form), 'Đã thêm người mới.')
              setForm('person', emptyPerson)
            }}
          >
            <Input label="Họ tên" value={form.full_name} onChange={(value) => setForm('person', { full_name: value })} required />
            <Input label="Điện thoại" value={form.phone} onChange={(value) => setForm('person', { phone: value })} />
            <Input label="Thư điện tử" value={form.email} onChange={(value) => setForm('person', { email: value })} />
            <label>
              Hình thức chơi
              <select value={form.attendance_type} onChange={(event) => setForm('person', { attendance_type: event.target.value })}>
                <option value="fixed">Đánh cố định</option>
                <option value="guest">Đánh vãng lai</option>
              </select>
            </label>
            <Input label="Ghi chú" value={form.note} onChange={(value) => setForm('person', { note: value })} />
            <button>Thêm người</button>
          </form>
        </Panel>
        <Panel title="Danh sách người">
          <SimpleTable
            rows={people}
            columns={[
              ['full_name', 'Họ tên'],
              ['phone', 'Điện thoại'],
              ['email', 'Thư điện tử'],
              ['attendance_type', 'Hình thức chơi', displayValue],
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
      {editingPerson && (
        <PersonEditModal
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
          onSubmit={(payload) => {
            submit(() => api.people.update(editingPerson.id, payload), 'Đã cập nhật người.')
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

function PersonEditModal({ person, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    full_name: person.full_name || '',
    phone: person.phone || '',
    email: person.email || '',
    attendance_type: person.attendance_type || 'guest',
    note: person.note || '',
  })

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <Modal title="Sửa người chơi" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(draft)
        }}
      >
        <Input label="Họ tên" value={draft.full_name} onChange={(value) => update('full_name', value)} required />
        <Input label="Điện thoại" value={draft.phone} onChange={(value) => update('phone', value)} />
        <Input label="Thư điện tử" value={draft.email} onChange={(value) => update('email', value)} />
        <label>
          Hình thức chơi
          <select value={draft.attendance_type} onChange={(event) => update('attendance_type', event.target.value)}>
            <option value="fixed">Đánh cố định</option>
            <option value="guest">Đánh vãng lai</option>
          </select>
        </label>
        <Input label="Ghi chú" value={draft.note} onChange={(value) => update('note', value)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}
