import { useMemo, useState } from 'react'
import { api } from '../../../api/client'
import { CheckoutBox, DebtTable } from '../../../components/finance'
import { Input, Modal, Panel, SearchBox, SelectPeople, StatusLine, filterRows } from '../../../components/common'
import { formatMoney } from '../../../utils/appUtils'

const STATUS_FILTERS = [
  ['all', 'Tất cả'],
  ['unpaid', 'Chưa thu'],
  ['paid', 'Đã thu'],
  ['cancelled', 'Đã hủy'],
]

export function DebtsPanel({
  people,
  debts,
  selectedPersonId,
  setSelectedPersonId,
  selectedPeriodId,
  createPayment,
  checkout,
  submit,
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCustomDebt, setShowCustomDebt] = useState(false)
  const [remindToast, setRemindToast] = useState('')
  const [remindToastType, setRemindToastType] = useState('success')

  async function handleRemindDebt() {
    if (!selectedPersonId) return
    try {
      await api.notifications.remindDebt(selectedPersonId)
      setRemindToastType('success')
      setRemindToast('Đã gửi nhắc nhở đến người này.')
    } catch (err) {
      setRemindToastType('error')
      setRemindToast(err.response?.data?.message || err.message)
    }
    setTimeout(() => setRemindToast(''), 3000)
  }

  const filtered = useMemo(() => {
    let rows = filterRows(debts, query, ['person.full_name', 'person.nickname', 'description', 'debt_type'])
    if (statusFilter !== 'all') rows = rows.filter((d) => d.status === statusFilter)
    return rows
  }, [debts, query, statusFilter])

  const selectedPersonDebts = useMemo(
    () => debts.filter((debt) => debt.person_id === selectedPersonId && debt.status === 'unpaid'),
    [debts, selectedPersonId],
  )
  const selectedPersonTotal = selectedPersonDebts.reduce(
    (sum, debt) => sum + Number(debt.amount || 0),
    0,
  )
  const totalOutstanding = debts
    .filter((debt) => debt.status === 'unpaid')
    .reduce((sum, debt) => sum + Number(debt.amount || 0), 0)
  const previousDebtTotal = debts
    .filter((debt) => debt.period_id !== selectedPeriodId && debt.status === 'unpaid')
    .reduce((sum, debt) => sum + Number(debt.amount || 0), 0)

  return (
    <section className="grid one">
      <Panel
        title="Tạo thanh toán"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SelectPeople people={people} value={selectedPersonId} onChange={setSelectedPersonId} />
            <button
              onClick={() => createPayment(selectedPersonId)}
              disabled={!selectedPersonId || selectedPersonDebts.length === 0}
            >
              Thanh toán tất cả · {formatMoney(selectedPersonTotal)}
            </button>
            <button
              className="btn-remind"
              onClick={handleRemindDebt}
              disabled={!selectedPersonId}
              title="Gửi thông báo nhắc nợ đến chuông 🔔 của người này"
            >
              🔔 Nhắc nợ
            </button>
          </div>
        }
      >
        <div className="debt-payment-summary">
          <strong>Một QR cho toàn bộ công nợ</strong>
          <span>
            Người đang chọn có {selectedPersonDebts.length} khoản chưa trả, tổng cộng {formatMoney(selectedPersonTotal)}.
          </span>
        </div>
        <StatusLine text={remindToast} type={remindToastType} />
        <CheckoutBox checkout={checkout} submit={submit} />
      </Panel>
      <Panel
        title="Công nợ"
        action={<button onClick={() => setShowCustomDebt(true)}>+ Tạo khoản thu thủ công</button>}
      >
        <div className="debt-ledger-summary">
          <span>Tổng chưa thu: <strong>{formatMoney(totalOutstanding)}</strong></span>
          <span>Nợ từ kỳ trước: <strong>{formatMoney(previousDebtTotal)}</strong></span>
        </div>
        <div className="search-filter-row">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên, mô tả..." />
          <div className="filter-tabs">
            {STATUS_FILTERS.map(([key, label]) => (
              <button
                key={key}
                className={statusFilter === key ? 'active' : ''}
                onClick={() => setStatusFilter(key)}
              >
                {label}
                {key !== 'all' && (
                  <span className="filter-count">{debts.filter((d) => d.status === key).length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <DebtTable debts={filtered} admin showPeriod submit={submit} />
      </Panel>

      {showCustomDebt && (
        <CustomDebtModal
          people={people.filter((person) => person.status === 'active')}
          periodId={selectedPeriodId}
          onClose={() => setShowCustomDebt(false)}
          onSubmit={(payload) => {
            submit(() => api.debts.create(payload), 'Đã tạo khoản thu thủ công.')
            setShowCustomDebt(false)
          }}
        />
      )}
    </section>
  )
}

function CustomDebtModal({ people, periodId, onClose, onSubmit }) {
  const [personId, setPersonId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const person = people.find((p) => p.id === personId)

  return (
    <Modal title="Tạo khoản thu thủ công" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (!personId || !amount) return
        onSubmit({
          person_id: personId,
          period_id: periodId,
          debt_type: 'other',
          amount: Number(amount),
          status: 'unpaid',
          description: description || 'Khoản thu thủ công',
        })
      }}>
        <label>Người nợ
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} required>
            <option value="">-- Chọn người --</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.nickname}</option>
            ))}
          </select>
        </label>

        <Input
          label="Số tiền (đ)"
          type="number"
          value={amount}
          onChange={setAmount}
          required
        />

        <Input
          label="Mô tả khoản thu"
          value={description}
          onChange={setDescription}
        />
        <small className="muted">Ví dụ: Tiền vãng lai người nhà anh Thuần, Tiền sân buổi thêm...</small>

        {personId && amount && (
          <div className="custom-debt-preview">
            <span>📋 Sẽ tạo: <strong>{person?.full_name}</strong> nợ <strong>{formatMoney(Number(amount))}</strong></span>
            {description && <span className="muted"> — {description}</span>}
          </div>
        )}

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Tạo khoản thu</button>
        </footer>
      </form>
    </Modal>
  )
}

export default DebtsPanel
