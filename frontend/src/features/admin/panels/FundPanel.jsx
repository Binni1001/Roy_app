import { api } from '../../../api/client'
import { ActionGroup, Input, Panel, SimpleTable } from '../../../components/common'
import { FundTable } from '../../../components/finance'
import { askConfirm, formatDate, formatMoney } from '../../../utils/appUtils'

export function FundPanel({ balances, fund, fundForm, selectedPeriodId, setForm, submit }) {
  return (
    <section className="grid two">
      <Panel title="Ghi thu/chi quỹ">
        <form className="form" onSubmit={(event) => {
          event.preventDefault()
          submit(
            () => api.fund.create({
              ...fundForm,
              period_id: selectedPeriodId,
              amount: Number(fundForm.amount || 0),
            }),
            'Đã ghi sổ quỹ.',
          )
        }}>
          <label>
            Loại
            <select value={fundForm.transaction_type} onChange={(event) => setForm('fund', { transaction_type: event.target.value })}>
              <option value="income">Thu</option>
              <option value="expense">Chi</option>
            </select>
          </label>
          <Input label="Số tiền" type="number" value={fundForm.amount} onChange={(value) => setForm('fund', { amount: value })} />
          <Input label="Nội dung" value={fundForm.description} onChange={(value) => setForm('fund', { description: value })} />
          <button>Ghi sổ</button>
        </form>
      </Panel>
      <Panel title="Số dư từng người">
        <SimpleTable
          rows={balances}
          columns={[['person.full_name', 'Người'], ['balance', 'Số dư', formatMoney], ['updated_at', 'Cập nhật', formatDate]]}
          actions={(balance) => (
            <ActionGroup>
              <button onClick={() => offsetBalance(balance, selectedPeriodId, submit)}>Bù trừ</button>
            </ActionGroup>
          )}
        />
      </Panel>
      <Panel title="Sổ quỹ câu lạc bộ" wide><FundTable rows={fund} /></Panel>
    </section>
  )
}

function offsetBalance(balance, selectedPeriodId, submit) {
  const personId = balance.person_id || balance.person?.id
  if (!personId || !selectedPeriodId) return
  if (!askConfirm('Bù trừ số dư của người này vào kỳ đang chọn?')) return
  submit(() => api.balances.offset(personId, selectedPeriodId), 'Đã bù trừ số dư.')
}
