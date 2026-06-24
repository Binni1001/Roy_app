import { useMemo, useState } from 'react'
import { CheckoutBox, DebtTable } from '../../../components/finance'
import { Panel, SearchBox, SelectPeople, filterRows } from '../../../components/common'

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
  createPayment,
  checkout,
  submit,
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    let rows = filterRows(debts, query, ['person.full_name', 'person.nickname', 'description', 'debt_type'])
    if (statusFilter !== 'all') rows = rows.filter((d) => d.status === statusFilter)
    return rows
  }, [debts, query, statusFilter])

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
        <DebtTable debts={filtered} admin submit={submit} />
      </Panel>
    </section>
  )
}

export default DebtsPanel
