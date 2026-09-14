import { useMemo, useState } from 'react'
import { isActivityPerson } from '../../../utils/activityEligibility'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SearchBox, SimpleTable, filterRows } from '../../../components/common'
import { FundTable } from '../../../components/finance'
import { formatDate, formatMoney } from '../../../utils/appUtils'

export function FundPanel({ balances, fund, debts = [], people = [], periods = [], fundForm, selectedPeriodId, setForm, submit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [showCarry, setShowCarry] = useState(false)
  const [offsetBalance, setOffsetBalance] = useState(null)
  const [offsetAllConfirm, setOffsetAllConfirm] = useState(false)
  const [fundQuery, setFundQuery] = useState('')

  const financialRows = useMemo(() => {
    const balancesByPerson = new Map(
      (balances || []).map((row) => [row.person_id || row.person?.id, row]),
    )
    const debtsByPerson = new Map()

    for (const debt of debts) {
      if (debt.status !== 'unpaid') continue
      const personId = debt.person_id || debt.person?.id
      if (!personId) continue
      debtsByPerson.set(personId, (debtsByPerson.get(personId) || 0) + Number(debt.amount || 0))
    }

    return people
      .filter(isActivityPerson)
      .map((person) => {
        const balanceRow = balancesByPerson.get(person.id)
        const balance = Number(balanceRow?.balance || 0)
        const debt = Number(debtsByPerson.get(person.id) || 0)
        return {
          id: person.id,
          person_id: person.id,
          person,
          balance,
          debt,
          net: balance - debt,
          updated_at: balanceRow?.updated_at || null,
        }
      })
      .sort((left, right) => left.net - right.net || left.person.full_name.localeCompare(right.person.full_name, 'vi'))
  }, [balances, debts, people])

  const hasOffsettableBalance = financialRows.some((row) => row.balance > 0 && row.debt > 0)

  const filteredFund = useMemo(
    () => filterRows(fund, fundQuery, ['description', 'person.full_name', 'transaction_type']),
    [fund, fundQuery]
  )

  return (
    <>
      <section className="grid one">
        <Panel
          title="Tình trạng tài chính thành viên"
          action={hasOffsettableBalance && (
            <ActionGroup>
              <button onClick={() => setOffsetAllConfirm(true)}>⇄ Bù trừ lại tất cả</button>
            </ActionGroup>
          )}
        >
          <SimpleTable
            rows={financialRows}
            columns={[
              ['person.full_name', 'Người'],
              ['balance', 'Được nhận', (value) => <MoneyState value={value} positive />],
              ['debt', 'Công nợ', (value) => <MoneyState value={value} negative />],
              ['net', 'Số ròng', (value) => <MoneyState value={value} />],
              ['updated_at', 'Cập nhật', (value) => value ? formatDate(value) : '—'],
            ]}
            actions={(row) => row.balance > 0 && row.debt > 0 ? (
              <ActionGroup>
                <button onClick={() => setOffsetBalance(row)}>Bù trừ lại</button>
              </ActionGroup>
            ) : null}
          />
        </Panel>
        <Panel
          title="Sổ quỹ câu lạc bộ"
          action={(
            <ActionGroup>
              <button onClick={() => setShowDeposit(true)}>+ Nộp quỹ</button>
              <button onClick={() => setShowRefund(true)}>💸 Hoàn tiền</button>
              <button onClick={() => setShowCarry(true)}>➡ Kết chuyển quỹ</button>
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

      {showCarry && (
        <CarryOverModal
          fund={fund}
          periods={periods}
          fromPeriodId={selectedPeriodId}
          onClose={() => setShowCarry(false)}
          onSubmit={(payload) => {
            submit(() => api.fund.carryOver(payload), 'Đã kết chuyển quỹ sang kỳ sau.')
            setShowCarry(false)
          }}
        />
      )}

      {showRefund && (
        <RefundModal
          people={people}
          balances={balances}
          periodId={selectedPeriodId}
          onClose={() => setShowRefund(false)}
          onSubmit={(payload) => {
            submit(() => api.fund.refund(payload), 'Đã hoàn tiền — số dư đã trừ về đúng.')
            setShowRefund(false)
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
          message={`Dùng số dư dương của ${offsetBalance.person?.full_name || 'người này'} để bù vào toàn bộ công nợ chưa trả, ưu tiên khoản cũ nhất?`}
          confirmText="Bù trừ"
          onClose={() => setOffsetBalance(null)}
          onConfirm={() => {
            submitOffsetBalance(offsetBalance, submit)
            setOffsetBalance(null)
          }}
        />
      )}

      {offsetAllConfirm && (
        <ConfirmModal
          title="Bù trừ tất cả"
          message="Kiểm tra lại toàn bộ nhóm và dùng số dư dương để bù vào mọi công nợ chưa trả, ưu tiên khoản cũ nhất của từng người?"
          confirmText="Bù trừ tất cả"
          onClose={() => setOffsetAllConfirm(false)}
          onConfirm={() => {
            submit(() => api.balances.offsetAll(), 'Đã bù trừ số dư cho cả nhóm.')
            setOffsetAllConfirm(false)
          }}
        />
      )}
    </>
  )
}

function DepositModal({ people, debts, periodId, onClose, onSubmit }) {
  const [personId, setPersonId] = useState('')
  const activePeople = people.filter(isActivityPerson)
  const canDeposit = activePeople.some((person) => person.id === personId)
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
        if (!canDeposit) return
        onSubmit({
          person_id: personId,
          period_id: periodId,
          amount: Number(amount || 0),
          description,
          debt_ids: selectedDebtIds,
        })
      }}>
        <label>Người nộp
          <select value={canDeposit ? personId : ''} onChange={(e) => selectPerson(e.target.value)} required>
            <option value="">-- Chọn người --</option>
            {activePeople.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.nickname}</option>
            ))}
          </select>
        </label>

        {canDeposit && (
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
        <button type="submit" disabled={!canDeposit}>Nộp quỹ</button>
        </footer>
      </form>
    </Modal>
  )
}

function CarryOverModal({ fund = [], periods = [], fromPeriodId, onClose, onSubmit }) {
  const [toPeriodId, setToPeriodId] = useState('')

  // Số dư quỹ kỳ hiện tại = thu + điều chỉnh − chi − hoàn
  const balance = useMemo(() => fund.reduce((sum, t) => {
    const amt = Number(t.amount) || 0
    if (t.transaction_type === 'income' || t.transaction_type === 'adjustment') return sum + amt
    if (t.transaction_type === 'expense' || t.transaction_type === 'refund') return sum - amt
    return sum
  }, 0), [fund])

  const fromPeriod = periods.find((p) => p.id === fromPeriodId)
  const targetOptions = periods.filter((p) => p.id !== fromPeriodId)

  return (
    <Modal title="➡ Kết chuyển quỹ sang kỳ sau" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (!toPeriodId || balance <= 0) return
        onSubmit({ from_period_id: fromPeriodId, to_period_id: toPeriodId })
      }}>
        <div className="stack">
          <p>Kỳ nguồn: <strong>{fromPeriod?.name || '—'}</strong></p>
          <p>Số dư mang sang: <strong>{formatMoney(balance)}</strong></p>
          {balance <= 0 && <p className="empty">Kỳ này không còn số dư dương để kết chuyển.</p>}
        </div>

        <label>Chuyển sang kỳ
          <select value={toPeriodId} onChange={(e) => setToPeriodId(e.target.value)} required>
            <option value="">-- Chọn kỳ đích --</option>
            {targetOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <p className="hint">Sẽ ghi 1 khoản <strong>chi</strong> ở kỳ nguồn (quỹ về 0) và 1 khoản <strong>thu</strong> tương ứng ở kỳ đích. Nợ chưa trả không bị ảnh hưởng.</p>

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={balance <= 0}>Kết chuyển</button>
        </footer>
      </form>
    </Modal>
  )
}

function RefundModal({ people, balances = [], periodId, onClose, onSubmit }) {
  const [personId, setPersonId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  // Số dư dương hiện tại của người đang chọn (gợi ý số cần hoàn)
  const positiveBalance = useMemo(() => {
    const row = balances.find((b) => (b.person_id || b.person?.id) === personId)
    const val = Number(row?.balance || 0)
    return val > 0 ? val : 0
  }, [balances, personId])

  const refundablePeople = useMemo(() => {
    const positivePersonIds = new Set(
      balances
        .filter((row) => Number(row.balance || 0) > 0)
        .map((row) => row.person_id || row.person?.id),
    )
    return people.filter((person) => isActivityPerson(person) && positivePersonIds.has(person.id))
  }, [balances, people])

  const requestedAmount = Number(amount || 0)
  const invalidAmount = requestedAmount <= 0 || requestedAmount > positiveBalance

  function selectPerson(id) {
    setPersonId(id)
    const row = balances.find((b) => (b.person_id || b.person?.id) === id)
    const val = Number(row?.balance || 0)
    setAmount(val > 0 ? String(val) : '')
  }

  return (
    <Modal title="💸 Hoàn tiền từ quỹ" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (!personId || invalidAmount) return
        onSubmit({
          transaction_type: 'refund',
          person_id: personId,
          period_id: periodId,
          amount: Number(amount),
          description: description || 'Hoàn tiền cầu cho người mua nhiều',
        })
      }}>
        <label>Hoàn cho ai
          <select value={personId} onChange={(e) => selectPerson(e.target.value)} required>
            <option value="">-- Chọn người --</option>
            {refundablePeople.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.nickname}</option>
            ))}
          </select>
        </label>

        {refundablePeople.length === 0 && (
          <p className="empty">Không có thành viên nào còn số dư dương để hoàn.</p>
        )}

        {personId && positiveBalance > 0 && (
          <p className="hint">Có thể hoàn tối đa <strong>{formatMoney(positiveBalance)}</strong>. Database sẽ bù công nợ chưa trả trước, sau đó mới cho rút phần còn lại.</p>
        )}

        <label>Số tiền hoàn
          <input
            type="number"
            min="1"
            max={positiveBalance || undefined}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        {requestedAmount > positiveBalance && positiveBalance > 0 && (
          <p className="form-error">Số tiền hoàn không được vượt quá {formatMoney(positiveBalance)}.</p>
        )}
        <Input label="Lý do" value={description} onChange={setDescription} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={!personId || invalidAmount}>Hoàn tiền (giảm quỹ)</button>
        </footer>
      </form>
    </Modal>
  )
}

function MoneyState({ value, positive = false, negative = false }) {
  const amount = Number(value || 0)
  const className = positive && amount > 0
    ? 'money-state positive'
    : negative && amount > 0
      ? 'money-state negative'
      : amount > 0
        ? 'money-state positive'
        : amount < 0
          ? 'money-state negative'
          : 'money-state'
  const displayed = negative && amount > 0 ? -amount : amount

  return <strong className={className}>{formatMoney(displayed)}</strong>
}

function submitOffsetBalance(balance, submit) {
  const personId = balance.person_id || balance.person?.id
  if (!personId) return
  submit(() => api.balances.offset(personId), 'Đã bù trừ số dư.')
}

export default FundPanel
