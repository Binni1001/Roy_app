/**
 * Plain-language grouping of club fund transactions for the period report.
 *
 * Income rows that paid a debt are classified by the debt's type (reliable); only
 * rows without a linked debt fall back to reading the description. Every category
 * carries a one-line hint so readers know what the money is.
 */

const norm = (s) => (s || '').toLowerCase()
const has = (text, ...parts) => parts.some((part) => text.includes(part))

export const INCOME_CATEGORIES = {
  fixed: { label: 'Tiền cố định thành viên đóng', hint: 'Phần đóng cố định của mỗi thành viên trong kỳ', unit: 'người' },
  guest: { label: 'Tiền khách vãng lai', hint: 'Khách chơi lẻ do thành viên dẫn theo', unit: 'khoản' },
  closeout: { label: 'Đóng thêm tiền cầu cuối kỳ', hint: 'Thành viên đóng phần tiền cầu còn thiếu sau khi chia cầu', unit: 'người' },
  carry: { label: 'Số dư kỳ trước chuyển sang', hint: 'Tiền còn lại của kỳ trước', unit: 'khoản' },
  court: { label: 'Thu hộ tiền sân / cầu', hint: 'Thành viên nộp lại tiền đã chi hộ', unit: 'khoản' },
  adjustment: { label: 'Điều chỉnh quỹ', hint: 'Khoản điều chỉnh do quản trị ghi tay', unit: 'khoản' },
  deposit: { label: 'Nộp quỹ thêm / thu khác', hint: 'Tiền nộp thêm hoặc khoản thu ghi tay, không gắn với công nợ', unit: 'khoản' }
}

export const EXPENSE_CATEGORIES = {
  refund: { label: 'Hoàn tiền cho thành viên', hint: 'Trả lại tiền dư cho thành viên', unit: 'người' },
  carry: { label: 'Kết chuyển sang kỳ sau', hint: 'Số dư chuyển sang kỳ mới', unit: 'khoản' },
  gear: { label: 'Lưới / keo / phụ kiện', hint: 'Dụng cầu lông ngoài quả cầu', unit: 'khoản' },
  court: { label: 'Tiền sân', hint: 'Thanh toán thuê sân', unit: 'khoản' },
  shuttle: { label: 'Mua cầu', hint: 'Chi từ quỹ để mua cầu', unit: 'khoản' },
  other: { label: 'Chi khác', hint: 'Khoản chi không thuộc nhóm nào ở trên', unit: 'khoản' }
}

const DEBT_TYPE_TO_INCOME = { monthly_fee: 'fixed', guest_fee: 'guest', shuttle_extra: 'closeout' }

/** @param debtById Map of debt id -> debt, used to read the debt type of a payment. */
export function incomeCategoryKey(fund, debtById = new Map()) {
  const d = norm(fund.description)
  if (has(d, 'mang sang')) return 'carry'

  const debt = fund.debt_id ? debtById.get(fund.debt_id) : null
  if (debt && DEBT_TYPE_TO_INCOME[debt.debt_type]) return DEBT_TYPE_TO_INCOME[debt.debt_type]

  if (has(d, 'co dinh', 'cố định', 'quỹ tháng', 'quy thang', 'monthly_fee')) return 'fixed'
  if (has(d, 'vãng lai', 'vang lai', 'guest', 'khách', 'khach')) return 'guest'
  if (has(d, 'shuttle_extra', 'tiền cầu', 'tien cau')) return 'closeout'
  if (has(d, 'sân', 'tien san', 'tiền sân')) return 'court'
  if (fund.transaction_type === 'adjustment') return 'adjustment'
  return 'deposit'
}

export function expenseCategoryKey(fund) {
  if (fund.transaction_type === 'refund') return 'refund'
  const d = norm(fund.description)
  if (has(d, 'kết chuyển', 'ket chuyen')) return 'carry'
  if (has(d, 'lưới', 'luoi', 'keo')) return 'gear'
  if (has(d, 'sân', 'tien san', 'tiền sân')) return 'court'
  if (has(d, 'cầu', 'cau')) return 'shuttle'
  return 'other'
}

/**
 * Totals per category, biggest first.
 * Each item: { key, label, hint, amount, count, people, countText }.
 */
export function groupFund(list, keyOf, definitions) {
  const groups = new Map()
  for (const row of list) {
    const key = keyOf(row)
    if (!groups.has(key)) groups.set(key, { key, amount: 0, count: 0, personIds: new Set() })
    const group = groups.get(key)
    group.amount += Number(row.amount) || 0
    group.count += 1
    const personId = row.person_id || row.person?.id
    if (personId) group.personIds.add(personId)
  }

  return [...groups.values()]
    .map((group) => {
      const def = definitions[group.key]
      const people = group.personIds.size
      const byPeople = def.unit === 'người' && people > 0
      return {
        key: group.key,
        label: def.label,
        hint: def.hint,
        amount: group.amount,
        count: group.count,
        people,
        countText: byPeople ? `${people} người` : `${group.count} khoản`
      }
    })
    .sort((a, b) => b.amount - a.amount)
}
