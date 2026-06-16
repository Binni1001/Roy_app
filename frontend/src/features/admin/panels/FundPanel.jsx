import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SimpleTable } from '../../../components/common'
import { FundTable } from '../../../components/finance'
import { formatDate, formatMoney } from '../../../utils/appUtils'

export function FundPanel({ balances, fund, fundForm, selectedPeriodId, setForm, submit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [offsetBalance, setOffsetBalance] = useState(null)

  return (
    <>
      <section className="grid one">
        <Panel title="Số dư từng người">
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
          action={<button onClick={() => setShowAdd(true)}>+ Ghi thu/chi</button>}
        >
          <FundTable rows={fund} />
        </Panel>
      </section>

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
    </>
  )
}

function submitOffsetBalance(balance, selectedPeriodId, submit) {
  const personId = balance.person_id || balance.person?.id
  if (!personId || !selectedPeriodId) return
  submit(() => api.balances.offset(personId, selectedPeriodId), 'Đã bù trừ số dư.')
}
