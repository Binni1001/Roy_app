import { api } from '../../../api/client'
import { ActionGroup, Input, Panel, SimpleTable } from '../../../components/common'
import { emptyPerson } from '../../../constants/appConstants'
import { askConfirm, displayValue } from '../../../utils/appUtils'

export function PeoplePanel({ people, form, setForm, submit }) {
  return (
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
              <button onClick={() => editPerson(person, submit)}>Sửa</button>
              <button className="danger" onClick={() => removePerson(person, submit)}>Xóa</button>
            </ActionGroup>
          )}
        />
      </Panel>
    </section>
  )
}

function editPerson(person, submit) {
  const fullName = window.prompt('Họ tên', person.full_name || '')
  if (fullName === null) return
  const phone = window.prompt('Điện thoại', person.phone || '')
  if (phone === null) return
  const email = window.prompt('Thư điện tử', person.email || '')
  if (email === null) return
  const attendanceType = window.prompt('Hình thức chơi: fixed hoặc guest', person.attendance_type || 'guest')
  if (attendanceType === null) return
  const note = window.prompt('Ghi chú', person.note || '')
  if (note === null) return
  submit(
    () => api.people.update(person.id, {
      full_name: fullName,
      phone,
      email,
      attendance_type: attendanceType,
      note,
    }),
    'Đã cập nhật người.',
  )
}

function removePerson(person, submit) {
  if (!askConfirm('Xóa người này?')) return
  submit(() => api.people.remove(person.id), 'Đã xóa người.')
}
