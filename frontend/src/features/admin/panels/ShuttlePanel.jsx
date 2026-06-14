import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { formatMoney } from '../../../utils/appUtils'

export function ShuttlePanel({
  people,
  expenses,
  settlementPreview,
  shuttleForm,
  selectedPeriodId,
  setForm,
  submit,
}) {
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)

  return (
    <>
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
          <Input label="Ngày mua" type="date" value={shuttleForm.buy_date} onChange={(value) => setForm('shuttle', { buy_date: value })} />
          <Input label="Ghi chú" value={shuttleForm.note} onChange={(value) => setForm('shuttle', { note: value })} />
          <button>Thêm chi phí</button>
        </form>
        </Panel>
        <Panel title="Chốt chia cầu">
        <div className="stack">
          <p>Tiền tạm tính: {formatMoney(settlementPreview?.total_shuttle_amount || 0)}</p>
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
              <button onClick={() => setEditingExpense(expense)}>Sửa</button>
              <button className="danger" onClick={() => setDeletingExpense(expense)}>Xóa</button>
            </ActionGroup>
          )}
        />
        </Panel>
      </section>
      {editingExpense && (
        <ShuttleExpenseEditModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSubmit={(payload) => {
            submit(() => api.shuttleExpenses.update(editingExpense.id, payload), 'Đã cập nhật chi phí cầu.')
            setEditingExpense(null)
          }}
        />
      )}
      {deletingExpense && (
        <ConfirmModal
          title="Xóa chi phí cầu"
          message={`Bạn chắc chắn muốn xóa chi phí ${formatMoney(deletingExpense.total_amount)} này?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeletingExpense(null)}
          onConfirm={() => {
            submit(() => api.shuttleExpenses.remove(deletingExpense.id), 'Đã xóa chi phí cầu.')
            setDeletingExpense(null)
          }}
        />
      )}
    </>
  )
}

function ShuttleExpenseEditModal({ expense, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    buy_type: expense.buy_type || 'tube',
    tube_count: expense.tube_count || 0,
    shuttle_per_tube: expense.shuttle_per_tube || 12,
    single_count: expense.single_count || 0,
    total_amount: expense.total_amount || 0,
    buy_date: expense.buy_date || '',
    note: expense.note || '',
  })

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <Modal title="Sửa chi phí cầu" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            buy_type: draft.buy_type,
            tube_count: Number(draft.tube_count || 0),
            shuttle_per_tube: Number(draft.shuttle_per_tube || 12),
            single_count: Number(draft.single_count || 0),
            total_amount: Number(draft.total_amount || 0),
            buy_date: draft.buy_date || undefined,
            note: draft.note,
          })
        }}
      >
        <label>
          Loại mua
          <select value={draft.buy_type} onChange={(event) => update('buy_type', event.target.value)}>
            <option value="tube">Theo ống</option>
            <option value="single">Cầu lẻ</option>
            <option value="mixed">Cả ống và lẻ</option>
          </select>
        </label>
        <Input label="Số ống" type="number" value={draft.tube_count} onChange={(value) => update('tube_count', value)} />
        <Input label="Số cầu mỗi ống" type="number" value={draft.shuttle_per_tube} onChange={(value) => update('shuttle_per_tube', value)} />
        <Input label="Số cầu lẻ" type="number" value={draft.single_count} onChange={(value) => update('single_count', value)} />
        <Input label="Tổng tiền" type="number" value={draft.total_amount} onChange={(value) => update('total_amount', value)} />
        <Input label="Ngày mua" type="date" value={draft.buy_date} onChange={(value) => update('buy_date', value)} />
        <Input label="Ghi chú" value={draft.note} onChange={(value) => update('note', value)} />
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}
