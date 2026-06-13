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
    <section className="grid two">
      <Panel title="Tạo thanh toán">
        <div className="form">
          <SelectPeople people={people} value={selectedPersonId} onChange={setSelectedPersonId} />
          <button onClick={() => createPayment(selectedPersonId)}>Tạo thanh toán PayOS</button>
          <CheckoutBox checkout={checkout} submit={submit} />
        </div>
      </Panel>
      <Panel title="Công nợ">
        <DebtTable debts={debts} admin submit={submit} />
      </Panel>
    </section>
  )
}
