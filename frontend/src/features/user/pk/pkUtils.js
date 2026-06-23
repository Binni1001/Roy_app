import { formatDate } from '../../../utils/appUtils'

export const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  active: 'Đang diễn ra',
  completed: 'Đã kết thúc',
  cancelled: 'Đã hủy',
}

export function sortByDate(arr) {
  return [...arr].sort((a, b) => {
    const da = a.played_at || a.created_at
    const db = b.played_at || b.created_at
    return new Date(db) - new Date(da)
  })
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getResultLock(m) {
  const now = new Date()
  const today = startOfDay(now)
  if (!m.played_at) return { canRecord: false, reason: 'Kèo chưa có ngày đấu' }
  const matchDay = startOfDay(new Date(m.played_at))
  if (matchDay > today) return { canRecord: false, reason: `Chưa đến ngày đấu (${formatDate(m.played_at)})` }
  if (m.status === 'completed' && m.updated_at) {
    const diffHours = (now - new Date(m.updated_at)) / (1000 * 60 * 60)
    if (diffHours > 24) return { canRecord: false, reason: 'Kết quả đã khoá sau 24 giờ' }
  }
  return { canRecord: true, reason: null }
}

export function isParticipant(m, activePerson) {
  if (!activePerson) return false
  return [m.challenger_id, m.opponent_id, m.challenger_partner_id, m.opponent_partner_id]
    .filter(Boolean)
    .includes(activePerson.id)
}
