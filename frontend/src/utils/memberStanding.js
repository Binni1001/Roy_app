import { isActivityPerson } from './activityEligibility.js'

/** End-of-period shuttle debts: closed with the period, collected in the next one. */
export const isCloseoutDebt = (debt) => debt?.debt_type === 'shuttle_extra'

function finish(list, extra = {}) {
  const positive = list.filter((r) => r.net > 0).sort((a, b) => b.net - a.net)
  const negative = list.filter((r) => r.net < 0).sort((a, b) => a.net - b.net)
  return {
    positive,
    negative,
    evenCount: list.filter((r) => r.net === 0).length,
    totalPositive: positive.reduce((total, r) => total + r.net, 0),
    totalNegative: negative.reduce((total, r) => total + r.net, 0),
    ...extra
  }
}

/**
 * Fallback when the period has no shuttle settlement: same rule as the
 * "Tình trạng tài chính thành viên" table, net = balance − unpaid debt.
 * `balance` is cumulative per person (not limited to one period).
 */
export function computeMemberStanding({ debts = [], balances = [], people = null } = {}) {
  const rows = new Map()
  const entry = (id, person) => {
    if (!rows.has(id)) {
      rows.set(id, { id, name: person?.full_name || person?.nickname || '?', balance: 0, debt: 0 })
    }
    return rows.get(id)
  }

  for (const row of balances) {
    const id = row.person_id || row.person?.id
    if (!id) continue
    entry(id, row.person).balance += Number(row.balance) || 0
  }
  for (const debt of debts) {
    if (debt.status !== 'unpaid') continue
    const id = debt.person_id || debt.person?.id
    if (!id) continue
    entry(id, debt.person).debt += Number(debt.amount) || 0
  }

  const allowed = people ? new Map(people.filter(isActivityPerson).map((p) => [p.id, p])) : null
  const list = []
  for (const row of rows.values()) {
    if (allowed) {
      const person = allowed.get(row.id)
      if (!person) continue
      row.name = person.full_name || person.nickname || row.name
    }
    row.net = row.balance - row.debt
    list.push(row)
  }
  return finish(list, { source: 'balance', settled: false })
}

/**
 * "Ai âm, ai dương" for one period, from the shuttle settlement:
 *   net = tiền đã ứng mua cầu − phần phải chịu
 *   net > 0 → dương (được nhận lại), net < 0 → âm (cần đóng, thu vào kỳ sau).
 * Closed periods return the saved result; open ones a live preview (settled=false).
 * Falls back to balance − debt when no settlement details exist.
 */
export function computeMonthStanding({ settlement, debts = [], balances = [], people = null } = {}) {
  const details = Array.isArray(settlement?.details) ? settlement.details : []
  if (details.length === 0) return computeMemberStanding({ debts, balances, people })

  const outstandingByPerson = new Map()
  for (const debt of debts) {
    if (!isCloseoutDebt(debt) || debt.status !== 'unpaid') continue
    const id = debt.person_id || debt.person?.id
    if (id) outstandingByPerson.set(id, (outstandingByPerson.get(id) || 0) + (Number(debt.amount) || 0))
  }

  const list = details.map((d) => {
    const net = Number(d.net_amount) || 0
    return {
      id: d.person_id,
      name: d.person?.full_name || d.person?.nickname || '?',
      paid: Number(d.paid_for_shuttles) || 0,
      share: Number(d.shuttle_share) || 0,
      net,
      outstanding: net < 0 ? (outstandingByPerson.get(d.person_id) || 0) : 0
    }
  })
  return finish(list, { source: 'settlement', settled: Boolean(settlement.settled) })
}
