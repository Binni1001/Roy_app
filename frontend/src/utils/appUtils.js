import { valueLabels } from '../constants/appConstants.js'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  return []
}

export function readTotal(value, keys) {
  for (const key of keys) {
    if (typeof value?.[key] === 'number') return value[key]
  }
  return 0
}

export function formatMoney(value) {
  return money.format(Number(value || 0))
}

export function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

export function formatDebtDescription(debt = {}) {
  let description = String(debt.description || '')
    .replace(/\s*\[guest_attendance:[^\]]+\]\s*/gi, '')
    .trim()

  if (!description) return valueLabels[debt.debt_type] || 'Khoản công nợ'

  const guestDebt = description.match(/^Tien khach vang lai\s+(.+?)\s+ngay\s+(\d{4}-\d{2}-\d{2})(.*)$/i)
  if (guestDebt) {
    description = `Phí khách vãng lai ngày ${formatDate(guestDebt[2])} - ${guestDebt[1]}${guestDebt[3]}`
  } else {
    description = description
      .replace(/^Tien co dinh\s*/i, 'Phí thành viên cố định - ')
      .replace(/^Tien cau phai dong them cuoi ky$/i, 'Tiền cầu đóng thêm cuối kỳ')
  }

  return description
    .replace(/\s*\|\s*Da bu tru bang so du ca nhan/gi, ' · Đã bù trừ bằng số dư cá nhân')
    .replace(/\s*\|\s*Da bu tru\s+([\d.]+)/gi, (_, amount) => ` · Đã bù trừ ${formatMoney(amount.replace(/\./g, ''))}`)
    .trim()
}

export function displayValue(value) {
  return valueLabels[value] || 'Không xác định'
}

export function errorText(error) {
  console.error(error)
  return error?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'
}

export function getSessionRole(session) {
  return (
    session?.user?.app_metadata?.role ||
    session?.user?.user_metadata?.role ||
    'user'
  )
}

export function canOpenAdmin(role) {
  return role === 'owner' || role === 'admin'
}

export function displayRole(role) {
  if (role === 'owner') return 'chủ sở hữu'
  if (role === 'admin') return 'quản trị viên'
  return 'người dùng'
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RB'
}
