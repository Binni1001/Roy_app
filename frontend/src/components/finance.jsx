import { useState } from 'react'
import { api } from '../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, SimpleTable, StatusBadge } from './common'
import { formatDate, formatMoney } from '../utils/appUtils'

export function DebtTable({ debts, admin = false, submit }) {
  return (
    <SimpleTable
      rows={debts}
      columns={[
        ['person.full_name', 'Người'],
        ['debt_type', 'Loại', (v) => <StatusBadge value={v} />],
        ['amount', 'Số tiền', formatMoney],
        ['status', 'Trạng thái', (v) => <StatusBadge value={v} />],
      ]}
      actions={admin ? (debt) => (
        <ActionGroup>
          <button onClick={() => submit(() => api.debts.updateStatus(debt.id, 'paid'), 'Đã đánh dấu đã thanh toán.')}>Đã thu</button>
          <button onClick={() => submit(() => api.debts.updateStatus(debt.id, 'unpaid'), 'Đã chuyển về chưa thanh toán.')}>Chưa thu</button>
          {debt.status !== 'cancelled' && (
            <button className="danger" onClick={() => submit(() => api.debts.updateStatus(debt.id, 'cancelled'), 'Đã hủy khoản nợ.')}>Hủy nợ</button>
          )}
        </ActionGroup>
      ) : null}
    />
  )
}

export function FundTable({ rows, submit }) {
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  return (
    <>
      <SimpleTable
        rows={rows}
        columns={[
          ['created_at', 'Ngày', formatDate],
          ['transaction_type', 'Loại', (v) => <StatusBadge value={v} />],
          ['amount', 'Số tiền', formatMoney],
          ['person.full_name', 'Người'],
          ['description', 'Nội dung'],
        ]}
        actions={submit ? (row) => (
          <ActionGroup>
            <button onClick={() => setEditing(row)}>Sửa</button>
            <button className="danger" onClick={() => setDeleting(row)}>Xóa</button>
          </ActionGroup>
        ) : null}
      />

      {editing && (
        <FundEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            submit(() => api.fund.update(editing.id, payload), 'Đã cập nhật giao dịch.')
            setEditing(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Xóa giao dịch"
          message={`Xóa giao dịch "${deleting.description || formatMoney(deleting.amount)}"?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            submit(() => api.fund.remove(deleting.id), 'Đã xóa giao dịch.')
            setDeleting(null)
          }}
        />
      )}
    </>
  )
}

const FUND_TYPES = ['income', 'expense', 'refund', 'adjustment']
const FUND_LABELS = { income: 'Thu', expense: 'Chi', refund: 'Hoàn tiền', adjustment: 'Điều chỉnh' }

function FundEditModal({ row, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    transaction_type: row.transaction_type || 'expense',
    amount: row.amount || 0,
    description: row.description || '',
  })
  function update(k, v) { setDraft((d) => ({ ...d, [k]: v })) }

  return (
    <Modal title="Sửa giao dịch quỹ" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...draft, amount: Number(draft.amount) }) }}>
        <label>Loại
          <select value={draft.transaction_type} onChange={(e) => update('transaction_type', e.target.value)}>
            {FUND_TYPES.map((t) => <option key={t} value={t}>{FUND_LABELS[t]}</option>)}
          </select>
        </label>
        <Input label="Số tiền" type="number" value={draft.amount} onChange={(v) => update('amount', v)} />
        <Input label="Nội dung" value={draft.description} onChange={(v) => update('description', v)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

export function CheckoutBox({ checkout, submit }) {
  if (!checkout) return <p className="empty">Chưa tạo lệnh thanh toán trong phiên này.</p>
  const url = checkout.checkout_url || checkout.checkoutUrl || checkout.payment?.checkout_url
  const paymentId = checkout.id || checkout.payment?.id
  return (
    <div className="checkout">
      <strong>Đã sẵn sàng thanh toán qua PayOS</strong>
      {url ? <a href={url} target="_blank" rel="noreferrer">{url}</a> : <code>{JSON.stringify(checkout)}</code>}
      {submit && paymentId && (
        <button className="danger" onClick={() => submit(() => api.payments.cancel(paymentId), 'Đã hủy lệnh thanh toán.')}>Hủy lệnh thanh toán</button>
      )}
    </div>
  )
}
