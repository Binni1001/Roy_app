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
  if (m.status === 'completed' || m.rating_locked_at) {
    return { canRecord: false, reason: 'Kết quả đã được khóa ngay khi hoàn tất' }
  }
  return { canRecord: true, reason: null }
}

export function isParticipant(m, activePerson) {
  if (!activePerson) return false
  return [m.challenger_id, m.opponent_id, m.challenger_partner_id, m.opponent_partner_id]
    .filter(Boolean)
    .includes(activePerson.id)
}

/* Gom trận theo ngày để hiển thị; số trận lấy từ match_number của database. */

// Khoá ngày dạng YYYY-MM-DD theo giờ địa phương
export function getDateKey(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

// "Thứ sáu, 26/06/2026"
export function formatMatchDate(dateStr) {
  if (!dateStr || dateStr === 'unknown') return 'Chưa có ngày'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Chưa có ngày'
  return `${WEEKDAYS[d.getDay()]}, ${formatDate(dateStr)}`
}

// 'challenger' | 'opponent' | null
export function getWinnerSide(m) {
  if (m.status !== 'completed') return null
  return m.winner_side || null
}

// Trả về [{ key, matches }] — ngày mới nhất trước; trong ngày: trận cũ trước (Trận 1 = sớm nhất)
export function groupMatchesByDate(matches) {
  const byDay = new Map()
  for (const m of matches) {
    const key = getDateKey(m.played_at || m.created_at)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(m)
  }
  const groups = []
  for (const [key, list] of byDay) {
    const sorted = [...list].sort((a, b) => {
      const ca = new Date(a.created_at || a.played_at)
      const cb = new Date(b.created_at || b.played_at)
      return ca - cb
    })
    groups.push({ key, matches: sorted })
  }
  groups.sort((a, b) => {
    if (a.key === 'unknown') return 1
    if (b.key === 'unknown') return -1
    return new Date(b.key) - new Date(a.key)
  })
  return groups
}
