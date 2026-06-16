import { CheckoutBox, DebtTable } from '../../../components/finance'
import { Panel, SelectPeople } from '../../../components/common'

export function DebtsPanel({
  people,
  debts,
  selectedPersonId,
  setSelectedPersonId,
  createPayment,
  checkout,
  submit,
}) {
  return (
    <section className="grid one">
      <Panel
        title="Tạo thanh toán"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SelectPeople people={people} value={selectedPersonId} onChange={setSelectedPersonId} />
            <button onClick={() => createPayment(selectedPersonId)}>Tạo thanh toán PayOS</button>
          </div>
        }
      >
        <CheckoutBox checkout={checkout} submit={submit} />
      </Panel>
      <Panel title="Công nợ">
        <DebtTable debts={debts} admin submit={submit} />
      </Panel>
    </section>
  )
}
