import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { formatDate, formatMoney } from '../../../utils/appUtils'

export function SessionsPanel({ people, sessions, sessionForm, guestForm, selectedPeriodId, setForm, submit }) {
  const [showAddSession, setShowAddSession] = useState(false)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [deletingSession, setDeletingSession] = useState(null)
  const [viewingGuests, setViewingGuests] = useState(null)
  const [guests, setGuests] = useState([])

  return (
    <>
      <section className="grid one">
        <Panel
          title="Danh sách buổi cầu"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAddGuest(true)}>+ Ghi khách</button>
              <button onClick={() => setShowAddSession(true)}>+ Tạo buổi</button>
            </div>
          }
        >
          <SimpleTable
            rows={sessions}
            columns={[['play_date', 'Ngày', formatDate], ['shuttle_used_count', 'Số cầu'], ['note', 'Ghi chú']]}
            actions={(session) => (
              <ActionGroup>
                <button onClick={() => {
                  api.guests.bySession(session.id).then((result) => {
                    setGuests(Array.isArray(result) ? result : [])
                    setViewingGuests(session)
                  }).catch(() => {
                    setGuests([])
                    setViewingGuests(session)
                  })
                }}>Khách</button>
                <button onClick={() => setEditingSession(session)}>Sửa</button>
                <button className="danger" onClick={() => setDeletingSession(session)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>

      {showAddSession && (
        <Modal title="Tạo buổi cầu" onClose={() => setShowAddSession(false)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault()
            submit(
              () => api.sessions.create({
                ...sessionForm,
                period_id: selectedPeriodId,
                shuttle_used_count: Number(sessionForm.shuttle_used_count || 0),
              }),
              'Đã tạo buổi cầu.',
            )
            setShowAddSession(false)
          }}>
            <Input label="Ngày chơi" type="date" value={sessionForm.play_date} onChange={(v) => setForm('session', { play_date: v })} required />
            <Input label="Số cầu đã dùng" type="number" value={sessionForm.shuttle_used_count} onChange={(v) => setForm('session', { shuttle_used_count: v })} />
            <Input label="Ghi chú" value={sessionForm.note} onChange={(v) => setForm('session', { note: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowAddSession(false)}>Hủy</button>
              <button type="submit">Tạo buổi</button>
            </footer>
          </form>
        </Modal>
      )}

      {showAddGuest && (
        <Modal title="Ghi nhận khách" onClose={() => setShowAddGuest(false)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault()
            submit(() => api.guests.create({ ...guestForm, amount: Number(guestForm.amount || 0) }), 'Đã ghi nhận khách.')
            setShowAddGuest(false)
          }}>
            <label>Buổi cầu
              <select value={guestForm.session_id} onChange={(e) => setForm('guest', { session_id: e.target.value })}>
                <option value="">Chọn buổi</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{formatDate(s.play_date)}</option>)}
              </select>
            </label>
            <SelectPeople people={people} value={guestForm.person_id} onChange={(v) => setForm('guest', { person_id: v })} />
            <Input label="Số tiền" type="number" value={guestForm.amount} onChange={(v) => setForm('guest', { amount: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowAddGuest(false)}>Hủy</button>
              <button type="submit">Ghi nhận</button>
            </footer>
          </form>
        </Modal>
      )}

      {viewingGuests && (
        <Modal title={`Khách vãng lai — ${formatDate(viewingGuests.play_date)}`} onClose={() => setViewingGuests(null)}>
          {guests.length === 0 ? (
            <p>Buổi này không có khách vãng lai.</p>
          ) : (
            <SimpleTable
              rows={guests}
              columns={[
                ['person.full_name', 'Họ tên'],
                ['amount', 'Tiền khách', formatMoney],
                ['note', 'Ghi chú'],
              ]}
            />
          )}
          <footer className="modal-actions">
            <button type="button" onClick={() => setViewingGuests(null)}>Đóng</button>
          </footer>
        </Modal>
      )}

      {editingSession && (
        <SessionEditModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSubmit={(payload) => {
            submit(() => api.sessions.update(editingSession.id, payload), 'Đã cập nhật buổi cầu.')
            setEditingSession(null)
          }}
        />
      )}

      {deletingSession && (
        <ConfirmModal
          title="Xóa buổi cầu"
          message={`Bạn chắc chắn muốn xóa buổi ngày ${formatDate(deletingSession.play_date)}?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeletingSession(null)}
          onConfirm={() => {
            submit(() => api.sessions.remove(deletingSession.id), 'Đã xóa buổi cầu.')
            setDeletingSession(null)
          }}
        />
      )}
    </>
  )
}

function SessionEditModal({ session, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    play_date: session.play_date || '',
    shuttle_used_count: session.shuttle_used_count || 0,
    note: session.note || '',
  })
  function update(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  return (
    <Modal title="Sửa buổi cầu" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ play_date: draft.play_date, shuttle_used_count: Number(draft.shuttle_used_count || 0), note: draft.note })
      }}>
        <Input label="Ngày chơi" type="date" value={draft.play_date} onChange={(v) => update('play_date', v)} required />
        <Input label="Số cầu đã dùng" type="number" value={draft.shuttle_used_count} onChange={(v) => update('shuttle_used_count', v)} />
        <Input label="Ghi chú" value={draft.note} onChange={(v) => update('note', v)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}
