import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ConfirmModal, Input, Modal, Panel, SimpleTable } from './common'
import { errorText, formatDate, formatMoney } from '../utils/appUtils'

const labels = { unpaid: 'Chưa trả', paid: 'Đã trả', cancelled: 'Đã hủy' }

export function ShuttleLoans({ periodId, manager = false, canCreate = false, submit }) {
  const [rows, setRows] = useState([])
  const [people, setPeople] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    const request = manager
      ? Promise.all([api.shuttleLoans.byPeriod(periodId), api.shuttleLoans.candidates(periodId)])
      : api.shuttleLoans.mine().then((loans) => [loans, []])
    request.then(([result, candidates]) => { if (current) { setRows(result || []); setPeople(candidates || []); setError('') } })
      .catch((err) => { if (current) { setRows([]); setError(errorText(err)) } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [periodId, manager, revision])

  async function change(action, message) {
    if (busy) return false
    setBusy(true)
    try {
      const result = await submit(action, message)
      if (!result) return false
      setRevision((n) => n + 1)
      setConfirm(null)
      return true
    } finally { setBusy(false) }
  }

  const outstanding = rows.filter((r) => r.status === 'unpaid').reduce((s, r) => s + Number(r.amount), 0)
  return <Panel title={manager ? 'Mượn cầu của quỹ' : 'Cầu mượn bạn đại diện trả tiền'}
    action={manager && canCreate && <button disabled={busy} onClick={() => setCreating(true)}>+ Ghi mượn cầu</button>}>
    {error && <p role="alert" className="form-error">{error}<button onClick={() => setRevision((n) => n + 1)}>Thử lại</button></p>}
    {loading ? <p>Đang tải khoản mượn…</p> : <>
      <p>Còn phải nộp quỹ: <strong>{formatMoney(outstanding)}</strong></p>
      <p className="hint">Người đại diện thu tiền của nhóm đánh sân ngoài và nộp đủ một lần cho quỹ. Khoản này được theo dõi riêng với tiền cầu chia cuối kỳ.</p>
      <SimpleTable rows={rows} columns={[
        ...(manager ? [['person.full_name', 'Người đại diện']] : [['period.name', 'Kỳ quỹ']]),
        ['borrowed_at', 'Ngày mượn', formatDate], ['quantity', 'Số quả'],
        ['unit_price', 'Giá mỗi quả', formatMoney], ['amount', 'Phải trả', formatMoney],
        ['status', 'Trạng thái', (value) => labels[value]], ['note', 'Ghi chú'],
      ]} actions={manager ? (row) => row.status === 'unpaid' && <div className="toolbar">
        <button disabled={busy} onClick={() => setConfirm({ action: 'repay', row })}>Đã nhận đủ tiền</button>
        <button disabled={busy} className="danger" onClick={() => setConfirm({ action: 'cancel', row })}>Hủy ghi nhầm</button>
      </div> : undefined} />
    </>}
    {creating && <LoanForm people={people} busy={busy} onClose={() => setCreating(false)} onSave={async (draft) => {
      if (await change(() => api.shuttleLoans.create({ ...draft, period_id: periodId }), 'Đã ghi khoản mượn cầu.')) setCreating(false)
    }} />}
    {confirm && <ConfirmModal title={confirm.action === 'repay' ? 'Xác nhận đã nhận tiền' : 'Hủy khoản mượn ghi nhầm'}
      message={confirm.action === 'repay'
        ? `Đã nhận đủ ${formatMoney(confirm.row.amount)} từ ${confirm.row.person?.full_name}? Số tiền sẽ được ghi thu vào Sổ quỹ một lần.`
        : 'Chỉ hủy khi ghi nhầm hoặc cầu chưa được giao. Khoản đã trả không thể hủy.'}
      loading={busy} onClose={() => { if (!busy) setConfirm(null) }} onConfirm={() => change(
        () => api.shuttleLoans[confirm.action](confirm.row.id), confirm.action === 'repay' ? 'Đã ghi thu tiền trả cầu mượn.' : 'Đã hủy khoản ghi nhầm.',
      )} />}
  </Panel>
}

function LoanForm({ people, busy, onSave, onClose }) {
  const [draft, setDraft] = useState({ person_id: '', quantity: '', unit_price: '', borrowed_at: '', note: '' })
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  return <Modal title="Ghi mượn cầu đánh sân ngoài" onClose={onClose}>
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(draft) }}>
      <label>Người đại diện trả tiền<select required value={draft.person_id} onChange={(e) => set('person_id', e.target.value)}>
        <option value="">Chọn người đại diện</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select></label>
      <Input required label="Ngày mượn" type="date" value={draft.borrowed_at} onChange={(v) => set('borrowed_at', v)} />
      <label>Số quả cầu<input required type="number" min="1" step="1" value={draft.quantity} onChange={(e) => set('quantity', e.target.value)} /></label>
      <label>Giá mỗi quả (đ)<input required type="number" min="1" step="1" value={draft.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></label>
      <p>Tổng phải trả quỹ: <strong>{formatMoney(Number(draft.quantity || 0) * Number(draft.unit_price || 0))}</strong></p>
      <Input label="Ghi chú / nhóm đánh sân ngoài" value={draft.note} onChange={(v) => set('note', v)} />
      <footer className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>Đóng</button>
        <button type="submit" disabled={busy}>Ghi mượn cầu</button></footer>
    </form>
  </Modal>
}
