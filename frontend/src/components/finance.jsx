import { api } from '../api/client'
import { ActionGroup, SimpleTable } from './common'
import { displayValue, formatDate, formatMoney } from '../utils/appUtils'

export function DebtTable({ debts, admin = false, submit }) {
  return (
    <SimpleTable
      rows={debts}
      columns={[
        ['person.full_name', 'Người'],
        ['debt_type', 'Loại', displayValue],
        ['amount', 'Số tiền', formatMoney],
        ['status', 'Trạng thái', displayValue],
      ]}
      actions={admin ? (debt) => (
        <ActionGroup>
          <button onClick={() => submit(() => api.debts.updateStatus(debt.id, 'paid'), 'Đã đánh dấu đã thanh toán.')}>Đã thu</button>
          <button onClick={() => submit(() => api.debts.updateStatus(debt.id, 'unpaid'), 'Đã chuyển về chưa thanh toán.')}>Chưa thu</button>
        </ActionGroup>
      ) : null}
    />
  )
}

export function FundTable({ rows }) {
  return (
    <SimpleTable
      rows={rows}
      columns={[
        ['created_at', 'Ngày', formatDate],
        ['transaction_type', 'Loại', displayValue],
        ['amount', 'Số tiền', formatMoney],
        ['description', 'Nội dung'],
      ]}
    />
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
