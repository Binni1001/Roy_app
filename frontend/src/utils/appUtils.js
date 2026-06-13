import { valueLabels } from '../constants/appConstants'

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

export function displayValue(value) {
  return valueLabels[value] || 'Không xác định'
}

export function errorText(error) {
  console.error(error)
  return 'Đã xảy ra lỗi khi xử lý dữ liệu. Vui lòng kiểm tra máy chủ hoặc mở bảng điều khiển trình duyệt để xem chi tiết.'
}

export function askConfirm(message) {
  return window.confirm(message)
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
