import { useRef, useState } from 'react'
import { api } from '../../../api/client'
import { ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { SessionCalendar } from '../../../components/SessionCalendar'
import { errorText, formatDate, formatMoney } from '../../../utils/appUtils'

export function SessionsPanel({ people, sessions, sessionForm, guestForm, selectedPeriodId, setForm, submit, canManageGuests = true, canDeleteSessions = true, canWriteSessions = true }) {
  const [showAddSession, setShowAddSession] = useState(false)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [deletingSession, setDeletingSession] = useState(null)
  const [viewingGuests, setViewingGuests] = useState(null)
  const [guests, setGuests] = useState([])
  const [guestError, setGuestError] = useState('')
  const [guestsLoading, setGuestsLoading] = useState(false)
  const guestRequest = useRef(0)

  async function viewGuests(session) {
    const request = ++guestRequest.current
    setViewingGuests(session); setGuests([]); setGuestError(''); setGuestsLoading(true)
    try {
      const result = await api.guests.bySession(session.id)
      if (request === guestRequest.current) setGuests(Array.isArray(result) ? result : [])
    } catch (error) {
      if (request === guestRequest.current) setGuestError(errorText(error))
    } finally {
      if (request === guestRequest.current) setGuestsLoading(false)
    }
  }

  return (
    <>
      <section className="grid one">
        <Panel
          title="Lịch buổi cầu"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              {canManageGuests && <button disabled={!canWriteSessions} onClick={() => setShowAddGuest(true)}>+ Ghi khách</button>}
              <button disabled={!canWriteSessions} onClick={() => setShowAddSession(true)}>+ Tạo buổi</button>
            </div>
          }
        >
          <SessionCalendar
            sessions={sessions}
            onEdit={canWriteSessions ? setEditingSession : undefined}
            onDelete={canDeleteSessions ? setDeletingSession : undefined}
            onViewGuests={viewGuests}
          />
          {!canManageGuests && <p className="muted">Bạn có thể xem khách; ghi khách hoặc xóa buổi có liên quan công nợ hiện cần owner xử lý.</p>}
        </Panel>
      </section>

      {showAddSession && (
        <Modal title="Tạo buổi cầu" onClose={() => setShowAddSession(false)}>
          <form className="form" onSubmit={async (e) => {
            e.preventDefault()
            const result = await submit(
              () => api.sessions.create({
                ...sessionForm,
                period_id: selectedPeriodId,
                shuttle_used_count: Number(sessionForm.shuttle_used_count || 0),
              }),
              'Đã tạo buổi cầu.',
            )
            if (result) setShowAddSession(false)
          }}>
            <Input label="Ngày chơi" type="date" value={sessionForm.play_date} onChange={(v) => setForm('session', { play_date: v })} required />
            <label>Số cầu đã dùng<input type="number" min="0" value={sessionForm.shuttle_used_count || ''} onChange={(e) => setForm('session', { shuttle_used_count: e.target.value })} /></label>
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
          <form className="form" onSubmit={async (e) => {
            e.preventDefault()
            const result = await submit(() => api.guests.create({ ...guestForm, amount: Number(guestForm.amount || 0) }), 'Đã ghi nhận khách.')
            if (result) setShowAddGuest(false)
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
          {guestsLoading ? <p role="status">Đang tải khách…</p> : guestError ? <div role="alert"><p>{guestError}</p><button onClick={() => viewGuests(viewingGuests)}>Thử lại</button></div> : guests.length === 0 ? (
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
          onSubmit={async (payload) => {
            const result = await submit(() => api.sessions.update(editingSession.id, payload), 'Đã cập nhật buổi cầu.')
            if (result) setEditingSession(null)
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
          onConfirm={async () => {
            const result = await submit(() => api.sessions.remove(deletingSession.id), 'Đã xóa buổi cầu.')
            if (result) setDeletingSession(null)
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
        <label>Số cầu đã dùng<input type="number" min="0" value={draft.shuttle_used_count || ''} onChange={(e) => update('shuttle_used_count', e.target.value)} /></label>
        <Input label="Ghi chú" value={draft.note} onChange={(v) => update('note', v)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

export default SessionsPanel
