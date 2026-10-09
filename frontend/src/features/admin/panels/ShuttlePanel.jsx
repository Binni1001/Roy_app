import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { formatMoney } from '../../../utils/appUtils'
import { ShuttleLoans } from '../../../components/ShuttleLoans'

export function ShuttlePanel({ people, expenses, settlementPreview, shuttleForm, selectedPeriodId, fundBalance = 0, periodOpen = false, submitting = false, setForm, submit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [showFundSplit, setShowFundSplit] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [showFundAllocation, setShowFundAllocation] = useState(false)
  const [confirmSettlement, setConfirmSettlement] = useState(false)
  const settled = Boolean(settlementPreview?.settled)
  const canWrite = periodOpen && !settled
  const unpaid = settlementPreview?.unpaid_before_settlement || []
  const canSettle = canWrite && settlementPreview?.can_settle === true && !submitting

  return (
    <>
      <section className="grid one">
        <Panel title="Chốt chia cầu">
          <div className="stack">
            <p>Tiền tạm tính: {formatMoney(settlementPreview?.total_shuttle_amount || 0)}</p>
            {settlementPreview?.error && <p className="form-error">{settlementPreview.error}</p>}
            {!settled && <>
              <p>Quỹ còn: <strong>{formatMoney(fundBalance)}</strong> · {unpaid.length} khoản cần thu trước khi chia cầu</p>
              {unpaid.length > 0 && <SimpleTable rows={unpaid} columns={[
                ['person_name', 'Cần thu của'], ['period_name', 'Kỳ'], ['amount', 'Còn nợ', formatMoney],
                ['kind', 'Khoản', (v) => v === 'shuttle_loan' ? 'Mượn cầu quỹ' : 'Công nợ'],
              ]} />}
              {fundBalance > 0 && <button disabled={!canWrite || unpaid.length > 0 || submitting} onClick={() => setShowFundAllocation(true)}>Dùng quỹ dư bù tiền cầu</button>}
              {fundBalance < 0 && <p className="form-error">Quỹ đang âm. Đối soát và ghi nhận tiền thực thu trước khi chia cầu.</p>}
              <p className="hint">Thu hết công nợ và tiền mượn cầu trước, dùng quỹ dư bù khoản mua cầu rồi mới chia. Sau chia, thành viên được giữ nợ tiền cầu sang kỳ mới.</p>
            </>}
            <button disabled={!canSettle} onClick={() => setConfirmSettlement(true)}>
              {settlementPreview?.settled ? 'Đã chốt chia cầu' : 'Chốt chia cầu'}
            </button>
            <p className="hint">{settled ? 'Đây là kết quả đã lưu tại thời điểm chốt kỳ.' : 'Không miễn = 1 suất; miễn 50% = nửa suất; miễn 100% = 0 suất. Chia tổng tiền theo tổng số suất, phân bổ đồng lẻ để khớp tổng tiền.'}</p>
            <SimpleTable rows={settlementPreview?.details || []} columns={[
              ['person.full_name', 'Thành viên'],
              ['shuttle_discount_percent', 'Miễn', (v) => `${v ?? 0}%`],
              ['paid_for_shuttles', 'Đã ứng mua cầu', formatMoney],
              ['shuttle_share', 'Phần phải chịu', formatMoney],
              ['net_amount', 'Được nhận (+) / Cần đóng (−)', formatMoney],
            ]} />
          </div>
        </Panel>
        <Panel
          title="Chi phí cầu"
          action={(
            <ActionGroup>
              <button disabled={!canWrite || submitting} onClick={() => setShowFundSplit(true)}>+ Mua cầu (quỹ thiếu)</button>
              <button disabled={!canWrite || submitting} onClick={() => setShowAdd(true)}>+ Thêm chi phí</button>
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
              ['total_amount', 'Cá nhân ứng đem chia', formatMoney],
              ['note', 'Ghi chú'],
            ]}
            actions={(expense) => (
              <ActionGroup>
                <button disabled={!canWrite || submitting} onClick={() => setEditingExpense(expense)}>Sửa</button>
                <button disabled={!canWrite || submitting} className="danger" onClick={() => setDeletingExpense(expense)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
        <ShuttleLoans key={selectedPeriodId} manager periodId={selectedPeriodId} canCreate={canWrite} people={people} submit={submit} />
      </section>

      {showFundAllocation && <FundAllocationModal expenses={expenses} fundBalance={fundBalance} busy={submitting}
        onClose={() => setShowFundAllocation(false)} onSubmit={async (payload) => {
          const result = await submit(() => api.shuttleSettlements.applyFund(selectedPeriodId, payload), 'Đã ghi chi quỹ bù khoản ứng mua cầu.')
          if (result) setShowFundAllocation(false)
        }} />}
      {confirmSettlement && <ConfirmModal title="Chốt chia tiền cầu" loading={submitting}
        message="Quỹ đã về 0 và đã thu hết các khoản nợ trước chia. Xác nhận ghi số dư/nợ tiền cầu theo bảng phân bổ? Kết quả sẽ được lưu và khóa."
        onClose={() => setConfirmSettlement(false)} onConfirm={async () => {
          const result = await submit(() => api.shuttleSettlements.settle(selectedPeriodId), 'Đã chốt chia cầu. Vào Kỳ quỹ để đóng kỳ rồi mở kỳ mới.')
          if (result) setConfirmSettlement(false)
        }} />}

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

function FundAllocationModal({ expenses, fundBalance, busy, onClose, onSubmit }) {
  const buyers = [...expenses.reduce((map, e) => {
    if (Number(e.total_amount) > 0) {
      const old = map.get(e.buyer_id) || { id: e.buyer_id, name: e.buyer?.full_name, amount: 0 }
      map.set(e.buyer_id, { ...old, amount: old.amount + Number(e.total_amount) })
    }
    return map
  }, new Map()).values()]
  const [buyerId, setBuyerId] = useState('')
  const [amount, setAmount] = useState('')
  const [paid, setPaid] = useState(false)
  const buyer = buyers.find((b) => b.id === buyerId)
  const valid = buyer && Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= Math.min(fundBalance, buyer.amount)
  return <Modal title="Dùng quỹ dư bù tiền cầu" onClose={onClose}>
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (valid && paid && !busy) onSubmit({ buyer_id: buyerId, amount: Number(amount) }) }}>
      <p>Quỹ còn {formatMoney(fundBalance)}. Chọn người đã ứng mua cầu để quỹ trả lại một phần khoản ứng trước khi chia.</p>
      <label>Người nhận tiền quỹ<select required value={buyerId} onChange={(e) => {
        setBuyerId(e.target.value); setPaid(false)
        setAmount(String(Math.min(fundBalance, buyers.find((b) => b.id === e.target.value)?.amount || 0)))
      }}><option value="">Chọn người mua cầu</option>{buyers.map((b) => <option key={b.id} value={b.id}>{b.name} — đã ứng {formatMoney(b.amount)}</option>)}</select></label>
      <label>Quỹ trả (đ)<input required type="number" min="1" step="1" max={buyer ? Math.min(fundBalance, buyer.amount) : fundBalance}
        value={amount} onChange={(e) => { setAmount(e.target.value); setPaid(false) }} /></label>
      {buyer && <p>Khoản ứng còn lại của {buyer.name}: <strong>{formatMoney(buyer.amount - Number(amount || 0))}</strong>. Phần này được dùng để chia cầu cuối kỳ.</p>}
      <label><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Tôi đã trả số tiền trên cho người mua cầu.</label>
      <p className="hint">Xác nhận sẽ ghi chi quỹ và giảm khoản ứng đem chia trong cùng một lần. Nếu cần, có thể bù cho nhiều người đến khi quỹ về 0.</p>
      <footer className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>Đóng</button>
        <button disabled={!valid || !paid || busy} type="submit">Ghi chi quỹ và cập nhật khoản ứng</button></footer>
    </form>
  </Modal>
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
