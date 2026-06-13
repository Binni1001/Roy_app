import { api } from '../../../api/client'
import { ActionGroup, Input, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { askConfirm, formatMoney } from '../../../utils/appUtils'

export function ShuttlePanel({
  people,
  expenses,
  settlementPreview,
  shuttleForm,
  selectedPeriodId,
  setForm,
  submit,
}) {
  return (
    <section className="grid two">
      <Panel title="Thêm chi phí cầu">
        <form className="form" onSubmit={(event) => {
          event.preventDefault()
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
        }}>
          <SelectPeople people={people} value={shuttleForm.buyer_id} onChange={(value) => setForm('shuttle', { buyer_id: value })} label="Người mua" />
          <label>
            Loại mua
            <select value={shuttleForm.buy_type} onChange={(event) => setForm('shuttle', { buy_type: event.target.value })}>
              <option value="tube">Theo ống</option>
              <option value="single">Cầu lẻ</option>
              <option value="mixed">Cả ống và lẻ</option>
            </select>
          </label>
          <Input label="Số ống" type="number" value={shuttleForm.tube_count} onChange={(value) => setForm('shuttle', { tube_count: value })} />
          <Input label="Số cầu mỗi ống" type="number" value={shuttleForm.shuttle_per_tube} onChange={(value) => setForm('shuttle', { shuttle_per_tube: value })} />
          <Input label="Số cầu lẻ" type="number" value={shuttleForm.single_count} onChange={(value) => setForm('shuttle', { single_count: value })} />
          <Input label="Tổng tiền" type="number" value={shuttleForm.total_amount} onChange={(value) => setForm('shuttle', { total_amount: value })} />
          <Input label="Ghi chú" value={shuttleForm.note} onChange={(value) => setForm('shuttle', { note: value })} />
          <button>Thêm chi phí</button>
        </form>
      </Panel>
      <Panel title="Chốt chia cầu">
        <div className="stack">
          <p>Tiền tạm tính: {formatMoney(settlementPreview?.total_amount || settlementPreview?.total || 0)}</p>
          <button onClick={() => submit(() => api.shuttleSettlements.settle(selectedPeriodId), 'Đã chốt chia cầu.')}>Chốt chia cầu</button>
        </div>
      </Panel>
      <Panel title="Chi phí cầu" wide>
        <SimpleTable
          rows={expenses}
          columns={[
            ['buyer.full_name', 'Người mua'],
            ['buy_type', 'Loại'],
            ['tube_count', 'Số ống'],
            ['single_count', 'Cầu lẻ'],
            ['total_amount', 'Tổng tiền', formatMoney],
            ['note', 'Ghi chú'],
          ]}
          actions={(expense) => (
            <ActionGroup>
              <button onClick={() => editShuttleExpense(expense, submit)}>Sửa</button>
              <button className="danger" onClick={() => removeShuttleExpense(expense, submit)}>Xóa</button>
            </ActionGroup>
          )}
        />
      </Panel>
    </section>
  )
}

function editShuttleExpense(expense, submit) {
  const tubeCount = window.prompt('Số ống', expense.tube_count || 0)
  if (tubeCount === null) return
  const shuttlePerTube = window.prompt('Số cầu mỗi ống', expense.shuttle_per_tube || 12)
  if (shuttlePerTube === null) return
  const singleCount = window.prompt('Số cầu lẻ', expense.single_count || 0)
  if (singleCount === null) return
  const totalAmount = window.prompt('Tổng tiền', expense.total_amount || 0)
  if (totalAmount === null) return
  const note = window.prompt('Ghi chú', expense.note || '')
  if (note === null) return
  submit(
    () => api.shuttleExpenses.update(expense.id, {
      tube_count: Number(tubeCount || 0),
      shuttle_per_tube: Number(shuttlePerTube || 12),
      single_count: Number(singleCount || 0),
      total_amount: Number(totalAmount || 0),
      note,
    }),
    'Đã cập nhật chi phí cầu.',
  )
}

function removeShuttleExpense(expense, submit) {
  if (!askConfirm('Xóa chi phí cầu này?')) return
  submit(() => api.shuttleExpenses.remove(expense.id), 'Đã xóa chi phí cầu.')
}
