import { isActivityPerson } from './activityEligibility.js'

/**
 * Who is "dương" (ahead) and who is "âm" (owes), using the same rule as the
 * "Tình trạng tài chính thành viên" table: net = balance − unpaid debt.
 *
 *  - balance : person_balances.balance, the credit the club owes the member
 *              (e.g. shuttle money they fronted). It is cumulative per person,
 *              not limited to one period.
 *  - debt    : unpaid debts in the period ledger.
 */
export function computeMemberStanding({ debts = [], balances = [], people = null } = {}) {
  const rows = new Map()
  const entry = (id, person) => {
    if (!rows.has(id)) {
      rows.set(id, {
        id,
        name: person?.full_name || person?.nickname || '?',
        balance: 0,
        debt: 0
      })
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

  const positive = list.filter((r) => r.net > 0).sort((a, b) => b.net - a.net)
  const negative = list.filter((r) => r.net < 0).sort((a, b) => a.net - b.net)

  return {
    positive,
    negative,
    evenCount: list.filter((r) => r.net === 0).length,
    totalPositive: positive.reduce((total, r) => total + r.net, 0),
    totalNegative: negative.reduce((total, r) => total + r.net, 0)
  }
}
