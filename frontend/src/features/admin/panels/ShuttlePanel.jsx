import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { formatMoney } from '../../../utils/appUtils'

export function ShuttlePanel({ people, expenses, settlementPreview, shuttleForm, selectedPeriodId, fundBalance = 0, setForm, submit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [showFundSplit, setShowFundSplit] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)

  return (
    <>
      <section className="grid one">
        <Panel title="Chốt chia cầu">
          <div className="stack">
            <p>Tiền tạm tính: {formatMoney(settlementPreview?.total_shuttle_amount || 0)}</p>
            <button onClick={() => submit(() => api.shuttleSettlements.settle(selectedPeriodId), 'Đã chốt chia cầu.')}>Chốt chia cầu</button>
          </div>
        </Panel>
        <Panel
          title="Chi phí cầu"
          action={(
            <ActionGroup>
              <button onClick={() => setShowFundSplit(true)}>+ Mua cầu (quỹ thiếu)</button>
              <button onClick={() => setShowAdd(true)}>+ Thêm chi phí</button>
            </ActionGroup>
          )}
        >
          <SimpleTable
            rows={expenses}
            columns={[
              ['buyer.full_name', 'Người mua'],
              ['buy_type', 'Loại'],
              ['tube_count', 'Số ống'],
              ['single_count', 'Cầu lẻ'],
              ['total_amount', 'Tổng tiền', formatMoney],
              ['note', 'Ghi chú'],
            ]}
            actions={(expense) => (
              <ActionGroup>
                <button onClick={() => setEditingExpense(expense)}>Sửa</button>
                <button className="danger" onClick={() => setDeletingExpense(expense)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>

      {showAdd && (
        <Modal title="Thêm chi phí cầu" onClose={() => setShowAdd(false)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault()
            submit(
              () => api.shuttleExpenses.create({
                ...shuttleForm,
                period_id: selectedPeriodId,
                tube_count: Number(shuttleForm.tube_count || 0),
                shuttle_per_tube: Number(shuttleForm.shuttle_per_tube || 12),
                single_count: Number(shuttleForm.single_count || 0),
                total_amount: Number(shuttleForm.total_amount || 0),
              }),
              'Đã thêm chi phí cầu.',
            )
            setShowAdd(false)
          }}>
            <SelectPeople people={people} value={shuttleForm.buyer_id} onChange={(v) => setForm('shuttle', { buyer_id: v })} label="Người mua" />
            <label>Loại mua
              <select value={shuttleForm.buy_type} onChange={(e) => setForm('shuttle', { buy_type: e.target.value })}>
                <option value="tube">Theo ống</option>
                <option value="single">Cầu lẻ</option>
                <option value="mixed">Cả ống và lẻ</option>
              </select>
            </label>
            <Input label="Số ống" type="number" value={shuttleForm.tube_count} onChange={(v) => setForm('shuttle', { tube_count: v })} />
            <Input label="Số cầu mỗi ống" type="number" value={shuttleForm.shuttle_per_tube} onChange={(v) => setForm('shuttle', { shuttle_per_tube: v })} />
            <Input label="Số cầu lẻ" type="number" value={shuttleForm.single_count} onChange={(v) => setForm('shuttle', { single_count: v })} />
            <Input label="Tổng tiền" type="number" value={shuttleForm.total_amount} onChange={(v) => setForm('shuttle', { total_amount: v })} />
            <Input label="Ngày mua" type="date" value={shuttleForm.buy_date} onChange={(v) => setForm('shuttle', { buy_date: v })} />
            <Input label="Ghi chú" value={shuttleForm.note} onChange={(v) => setForm('shuttle', { note: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowAdd(false)}>Hủy</button>
              <button type="submit">Thêm chi phí</button>
            </footer>
          </form>
        </Modal>
      )}

      {showFundSplit && (
        <FundSplitModal
          people={people}
          periodId={selectedPeriodId}
          fundBalance={fundBalance}
          onClose={() => setShowFundSplit(false)}
          onSubmit={(payload) => {
            submit(() => api.shuttleExpenses.createWithFundSplit(payload), 'Đã ghi nhận mua cầu (chia nguồn quỹ/cá nhân).')
            setShowFundSplit(false)
          }}
        />
      )}

      {editingExpense && (
        <ShuttleExpenseEditModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSubmit={(payload) => {
            submit(() => api.shuttleExpenses.update(editingExpense.id, payload), 'Đã cập nhật chi phí cầu.')
            setEditingExpense(null)
          }}
        />
      )}

      {deletingExpense && (
        <ConfirmModal
          title="Xóa chi phí cầu"
          message={`Bạn chắc chắn muốn xóa chi phí ${formatMoney(deletingExpense.total_amount)} này?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeletingExpense(null)}
          onConfirm={() => {
            submit(() => api.shuttleExpenses.remove(deletingExpense.id), 'Đã xóa chi phí cầu.')
            setDeletingExpense(null)
          }}
        />
      )}
    </>
  )
}

function ShuttleExpenseEditModal({ expense, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    buy_type: expense.buy_type || 'tube',
    tube_count: expense.tube_count || 0,
    shuttle_per_tube: expense.shuttle_per_tube || 12,
    single_count: expense.single_count || 0,
    total_amount: expense.total_amount || 0,
    buy_date: expense.buy_date || '',
    note: expense.note || '',
  })
  function update(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  return (
    <Modal title="Sửa chi phí cầu" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          buy_type: draft.buy_type,
          tube_count: Number(draft.tube_count || 0),
          shuttle_per_tube: Number(draft.shuttle_per_tube || 12),
          single_count: Number(draft.single_count || 0),
          total_amount: Number(draft.total_amount || 0),
          buy_date: draft.buy_date || undefined,
          note: draft.note,
        })
      }}>
        <label>Loại mua
          <select value={draft.buy_type} onChange={(e) => update('buy_type', e.target.value)}>
            <option value="tube">Theo ống</option>
            <option value="single">Cầu lẻ</option>
            <option value="mixed">Cả ống và lẻ</option>
          </select>
        </label>
        <Input label="Số ống" type="number" value={draft.tube_count} onChange={(v) => update('tube_count', v)} />
        <Input label="Số cầu mỗi ống" type="number" value={draft.shuttle_per_tube} onChange={(v) => update('shuttle_per_tube', v)} />
        <Input label="Số cầu lẻ" type="number" value={draft.single_count} onChange={(v) => update('single_count', v)} />
        <Input label="Tổng tiền" type="number" value={draft.total_amount} onChange={(v) => update('total_amount', v)} />
        <Input label="Ngày mua" type="date" value={draft.buy_date} onChange={(v) => update('buy_date', v)} />
        <Input label="Ghi chú" value={draft.note} onChange={(v) => update('note', v)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

function FundSplitModal({ people, periodId, fundBalance = 0, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    buyer_id: '',
    buy_type: 'tube',
    tube_count: 1,
    shuttle_per_tube: 12,
    single_count: 0,
    total_price: '',
    fund_amount: '',
    buy_date: new Date().toISOString().slice(0, 10),
    note: '',
  })
  const [error, setError] = useState('')

  function update(field, value) {
    setError('')
    setDraft((d) => ({ ...d, [field]: value }))
  }

  // Khi nhập tổng giá: quỹ trả tối đa (bằng số dư quỹ), phần thiếu thành viên bù
  function updateTotalPrice(value) {
    setError('')
    const total = Number(value || 0)
    const suggestedFund = Math.max(0, Math.min(total, Number(fundBalance) || 0))
    setDraft((d) => ({ ...d, total_price: value, fund_amount: suggestedFund ? String(suggestedFund) : '' }))
  }

  const totalPrice = Number(draft.total_price || 0)
  const fundAmount = Number(draft.fund_amount || 0)
  const personalAmount = totalPrice - fundAmount

  function validate() {
    if (!draft.buyer_id) return 'Vui lòng chọn người mua/đại diện mua cầu.'
    if (!totalPrice || totalPrice <= 0) return 'Tổng giá mua cầu phải lớn hơn 0.'
    if (fundAmount < 0) return 'Số tiền quỹ chi không được âm.'
    if (fundAmount > totalPrice) return 'Số tiền quỹ chi không được lớn hơn tổng giá mua cầu.'
    if (personalAmount < 0) return 'Số tiền thành viên tự bỏ không hợp lệ.'
    if (fundAmount === 0 && personalAmount === 0) return 'Phải có ít nhất một nguồn chi (quỹ hoặc cá nhân) lớn hơn 0.'
    const tubeCount = Number(draft.tube_count || 0)
    const singleCount = Number(draft.single_count || 0)
    if (draft.buy_type === 'tube' && tubeCount <= 0) return 'Mua theo ống thì số ống phải lớn hơn 0.'
    if (draft.buy_type === 'single' && singleCount <= 0) return 'Mua lẻ thì số cầu lẻ phải lớn hơn 0.'
    if (draft.buy_type === 'mixed' && tubeCount <= 0 && singleCount <= 0) return 'Mua hỗn hợp thì phải có số ống hoặc số cầu lẻ.'
    if (draft.buy_date && draft.buy_date > new Date().toISOString().slice(0, 10)) return 'Ngày mua không được ở tương lai.'
    return ''
  }

  return (
    <Modal title="Mua cầu khi quỹ thiếu" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        const message = validate()
        if (message) {
          setError(message)
          return
        }
        onSubmit({
          period_id: periodId,
          buyer_id: draft.buyer_id,
          buy_type: draft.buy_type,
          tube_count: Number(draft.tube_count || 0),
          shuttle_per_tube: Number(draft.shuttle_per_tube || 12),
          single_count: Number(draft.single_count || 0),
          total_price: totalPrice,
          fund_amount: fundAmount,
          buy_date: draft.buy_date,
          note: draft.note,
        })
      }}>
        <p className="empty">
          Quỹ trả tiền cầu trước; quỹ thiếu bao nhiêu thì thành viên bù bấy nhiêu.
          Phần quỹ chi tự ghi vào Sổ quỹ; phần thành viên bù sẽ được chia khi chốt tiền cầu.
        </p>
        <div className="stack" style={{ background: 'rgba(216,174,82,0.08)', border: '1px solid rgba(216,174,82,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
          <p>Quỹ hiện có: <strong style={{ color: '#d8ae52' }}>{formatMoney(fundBalance)}</strong></p>
          <p>Quỹ chi lần này: <strong style={{ color: '#e05252' }}>{formatMoney(fundAmount)}</strong></p>
          <p>Thành viên phải bù: <strong style={{ color: personalAmount > 0 ? '#e0a052' : '#4caf7d' }}>{formatMoney(personalAmount > 0 ? personalAmount : 0)}</strong>{personalAmount <= 0 && ' (quỹ đủ trả hết)'}</p>
        </div>
        <SelectPeople people={people} value={draft.buyer_id} onChange={(v) => update('buyer_id', v)} label="Người mua/đại diện" />
        <label>Loại mua
          <select value={draft.buy_type} onChange={(e) => update('buy_type', e.target.value)}>
            <option value="tube">Theo ống</option>
            <option value="single">Cầu lẻ</option>
            <option value="mixed">Cả ống và lẻ</option>
          </select>
        </label>
        <Input label="Số ống" type="number" value={draft.tube_count} onChange={(v) => update('tube_count', v)} />
        <Input label="Số cầu mỗi ống" type="number" value={draft.shuttle_per_tube} onChange={(v) => update('shuttle_per_tube', v)} />
        <Input label="Số cầu lẻ" type="number" value={draft.single_count} onChange={(v) => update('single_count', v)} />
        <Input label="Tổng giá mua cầu" type="number" value={draft.total_price} onChange={updateTotalPrice} />
        <Input label="Số tiền quỹ chi (tự điền, sửa được)" type="number" value={draft.fund_amount} onChange={(v) => update('fund_amount', v)} />
        <Input label="Ngày mua" type="date" value={draft.buy_date} onChange={(v) => update('buy_date', v)} />
        <Input label="Ghi chú" value={draft.note} onChange={(v) => update('note', v)} />
        {error && <p className="error">{error}</p>}
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Ghi nhận mua cầu</button>
        </footer>
      </form>
    </Modal>
  )
}

export default ShuttlePanel
