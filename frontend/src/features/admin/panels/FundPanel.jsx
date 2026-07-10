import { useMemo, useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SearchBox, SimpleTable, filterRows } from '../../../components/common'
import { FundTable } from '../../../components/finance'
import { formatDate, formatMoney } from '../../../utils/appUtils'

export function FundPanel({ balances, fund, debts = [], people = [], fundForm, selectedPeriodId, setForm, submit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [offsetBalance, setOffsetBalance] = useState(null)
  const [offsetAllConfirm, setOffsetAllConfirm] = useState(false)
  const [fundQuery, setFundQuery] = useState('')

  const hasPositiveBalance = (balances || []).some((b) => Number(b.balance) > 0)

  const filteredFund = useMemo(
    () => filterRows(fund, fundQuery, ['description', 'person.full_name', 'transaction_type']),
    [fund, fundQuery]
  )

  return (
    <>
      <section className="grid one">
        <Panel
          title="Số dư từng người"
          action={hasPositiveBalance && (
            <ActionGroup>
              <button onClick={() => setOffsetAllConfirm(true)}>⇄ Bù trừ tất cả</button>
            </ActionGroup>
          )}
        >
          <SimpleTable
            rows={balances}
            columns={[['person.full_name', 'Người'], ['balance', 'Số dư', formatMoney], ['updated_at', 'Cập nhật', formatDate]]}
            actions={(balance) => (
              <ActionGroup>
                <button onClick={() => setOffsetBalance(balance)}>Bù trừ</button>
              </ActionGroup>
            )}
          />
        </Panel>
        <Panel
          title="Sổ quỹ câu lạc bộ"
          action={(
            <ActionGroup>
              <button onClick={() => setShowDeposit(true)}>+ Nộp quỹ</button>
              <button onClick={() => setShowAdd(true)}>+ Ghi thu/chi</button>
            </ActionGroup>
          )}
        >
          <SearchBox value={fundQuery} onChange={setFundQuery} placeholder="Tìm theo nội dung, người, loại..." />
          <FundTable rows={filteredFund} submit={submit} />
        </Panel>
      </section>

      {showDeposit && (
        <DepositModal
          people={people}
          debts={debts}
          periodId={selectedPeriodId}
          onClose={() => setShowDeposit(false)}
          onSubmit={(payload) => {
            submit(() => api.fund.deposit(payload), 'Đã nộp quỹ.')
            setShowDeposit(false)
          }}
        />
      )}

      {showAdd && (
        <Modal title="Ghi thu/chi quỹ" onClose={() => setShowAdd(false)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault()
            submit(
              () => api.fund.create({ ...fundForm, period_id: selectedPeriodId, amount: Number(fundForm.amount || 0) }),
              'Đã ghi sổ quỹ.',
            )
            setShowAdd(false)
          }}>
            <label>Loại
              <select value={fundForm.transaction_type} onChange={(e) => setForm('fund', { transaction_type: e.target.value })}>
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
                <option value="refund">Hoàn tiền</option>
                <option value="adjustment">Điều chỉnh</option>
              </select>
            </label>
            <Input label="Số tiền" type="number" value={fundForm.amount} onChange={(v) => setForm('fund', { amount: v })} />
            <Input label="Nội dung" value={fundForm.description} onChange={(v) => setForm('fund', { description: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowAdd(false)}>Hủy</button>
              <button type="submit">Ghi sổ</button>
            </footer>
          </form>
        </Modal>
      )}

      {offsetBalance && (
        <ConfirmModal
          title="Bù trừ số dư"
          message={`Bù trừ số dư của ${offsetBalance.person?.full_name || 'người này'} vào kỳ đang chọn?`}
          confirmText="Bù trừ"
          onClose={() => setOffsetBalance(null)}
          onConfirm={() => {
            submitOffsetBalance(offsetBalance, selectedPeriodId, submit)
            setOffsetBalance(null)
          }}
        />
      )}

      {offsetAllConfirm && (
        <ConfirmModal
          title="Bù trừ tất cả"
          message="Lấy số dư dương của MỌI người bù vào nợ chưa trả của kỳ đang chọn? Người nào dư tiền sẽ được trừ thẳng vào khoản phải nộp kỳ này."
          confirmText="Bù trừ tất cả"
          onClose={() => setOffsetAllConfirm(false)}
          onConfirm={() => {
            if (selectedPeriodId) submit(() => api.balances.offsetAll(selectedPeriodId), 'Đã bù trừ số dư cho cả nhóm.')
            setOffsetAllConfirm(false)
          }}
        />
      )}
    </>
  )
}

function DepositModal({ people, debts, periodId, onClose, onSubmit }) {
  const [personId, setPersonId] = useState('')
  const [selectedDebtIds, setSelectedDebtIds] = useState([])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const personDebts = useMemo(
    () => debts.filter((d) => (d.person_id || d.person?.id) === personId && d.status === 'unpaid'),
    [debts, personId],
  )

  function selectPerson(id) {
    setPersonId(id)
    setSelectedDebtIds([])
    setAmount('')
  }

  function toggleDebt(debt) {
    const isSelected = selectedDebtIds.includes(debt.id)
    const nextIds = isSelected
      ? selectedDebtIds.filter((id) => id !== debt.id)
      : [...selectedDebtIds, debt.id]
    setSelectedDebtIds(nextIds)
    const total = debts
      .filter((d) => nextIds.includes(d.id))
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)
    setAmount(total ? String(total) : '')
  }

  return (
    <Modal title="Nộp quỹ" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (!personId) return
        onSubmit({
          person_id: personId,
          period_id: periodId,
          amount: Number(amount || 0),
          description,
          debt_ids: selectedDebtIds,
        })
      }}>
        <label>Người nộp
          <select value={personId} onChange={(e) => selectPerson(e.target.value)} required>
            <option value="">-- Chọn người --</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.nickname}</option>
            ))}
          </select>
        </label>

        {personId && (
          <div className="stack">
            <strong>Khoản nợ chưa thu của người này</strong>
            {personDebts.length === 0 && <p className="empty">Không có khoản nợ chưa thu.</p>}
            {personDebts.map((debt) => (
              <label key={debt.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedDebtIds.includes(debt.id)}
                  onChange={() => toggleDebt(debt)}
                />
                {debt.description || debt.debt_type} — {formatMoney(debt.amount)}
              </label>
            ))}
          </div>
        )}

        <Input label="Số tiền nộp vào quỹ" type="number" value={amount} onChange={setAmount} />
        <Input label="Nội dung" value={description} onChange={setDescription} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Nộp quỹ</button>
        </footer>
      </form>
    </Modal>
  )
}

function submitOffsetBalance(balance, selectedPeriodId, submit) {
  const personId = balance.person_id || balance.person?.id
  if (!personId || !selectedPeriodId) return
  submit(() => api.balances.offset(personId, selectedPeriodId), 'Đã bù trừ số dư.')
}

export default FundPanel
