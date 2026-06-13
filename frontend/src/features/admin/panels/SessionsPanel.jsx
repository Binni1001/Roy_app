import { api } from '../../../api/client'
import { ActionGroup, Input, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { askConfirm, formatDate } from '../../../utils/appUtils'

export function SessionsPanel({ people, sessions, sessionForm, guestForm, selectedPeriodId, setForm, submit }) {
  return (
    <section className="grid two">
      <Panel title="Tạo buổi cầu">
        <form className="form" onSubmit={(event) => {
          event.preventDefault()
          submit(
            () => api.sessions.create({
              ...sessionForm,
              period_id: selectedPeriodId,
              shuttle_used_count: Number(sessionForm.shuttle_used_count || 0),
            }),
            'Đã tạo buổi cầu.',
          )
        }}>
          <Input label="Ngày chơi" type="date" value={sessionForm.play_date} onChange={(value) => setForm('session', { play_date: value })} required />
          <Input label="Số cầu đã dùng" type="number" value={sessionForm.shuttle_used_count} onChange={(value) => setForm('session', { shuttle_used_count: value })} />
          <Input label="Ghi chú" value={sessionForm.note} onChange={(value) => setForm('session', { note: value })} />
          <button>Tạo buổi</button>
        </form>
      </Panel>
      <Panel title="Ghi nhận khách">
        <form className="form" onSubmit={(event) => {
          event.preventDefault()
          submit(() => api.guests.create({ ...guestForm, amount: Number(guestForm.amount || 0) }), 'Đã ghi nhận khách.')
        }}>
          <label>
            Buổi cầu
            <select value={guestForm.session_id} onChange={(event) => setForm('guest', { session_id: event.target.value })}>
              <option value="">Chọn buổi</option>
              {sessions.map((session) => <option key={session.id} value={session.id}>{formatDate(session.play_date)}</option>)}
            </select>
          </label>
          <SelectPeople people={people} value={guestForm.person_id} onChange={(value) => setForm('guest', { person_id: value })} />
          <Input label="Số tiền" type="number" value={guestForm.amount} onChange={(value) => setForm('guest', { amount: value })} />
          <button>Ghi nhận</button>
        </form>
      </Panel>
      <Panel title="Danh sách buổi cầu" wide>
        <SimpleTable
          rows={sessions}
          columns={[['play_date', 'Ngày', formatDate], ['shuttle_used_count', 'Số cầu'], ['note', 'Ghi chú']]}
          actions={(session) => (
            <ActionGroup>
              <button onClick={() => editSession(session, submit)}>Sửa</button>
              <button className="danger" onClick={() => removeSession(session, submit)}>Xóa</button>
            </ActionGroup>
          )}
        />
      </Panel>
    </section>
  )
}

function editSession(session, submit) {
  const sessionDate = window.prompt('Ngày chơi', session.play_date || '')
  if (sessionDate === null) return
  const shuttleUsedCount = window.prompt('Số cầu đã dùng', session.shuttle_used_count || 0)
  if (shuttleUsedCount === null) return
  const note = window.prompt('Ghi chú', session.note || '')
  if (note === null) return
  submit(
    () => api.sessions.update(session.id, {
      play_date: sessionDate,
      shuttle_used_count: Number(shuttleUsedCount || 0),
      note,
    }),
    'Đã cập nhật buổi cầu.',
  )
}

function removeSession(session, submit) {
  if (!askConfirm('Xóa buổi cầu này?')) return
  submit(() => api.sessions.remove(session.id), 'Đã xóa buổi cầu.')
}
