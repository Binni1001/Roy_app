/**
 * Xếp hạng PK bằng hệ thống rating Glicko (áp dụng theo từng trận).
 * - Không phụ thuộc số trận cân bằng: điểm đổi theo kết quả × trình độ đối thủ.
 * - RD (độ tin cậy): người mới/ít trận -> "tạm tính", chưa xếp hạng chính thức.
 * - Đôi: rating đội = trung bình 2 người; cập nhật cả 2.
 * - Tính theo thứ tự thời gian (phát lại các trận). Mỗi kỳ dữ liệu riêng nên
 *   rating tự bắt đầu lại từ BASE_RATING cho kỳ đó.
 */

export const BASE_RATING = 1000
export const BASE_RD = 350
export const PROVISIONAL_RD = 110   // RD trên mức này coi là "tạm tính"
const Q = Math.log(10) / 400
const RD_FLOOR = 30

function gRD(rd) {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI))
}

function expectedScore(r, rOpp, rdOpp) {
  return 1 / (1 + Math.pow(10, (-gRD(rdOpp) * (r - rOpp)) / 400))
}

// Cập nhật 1 người sau 1 trận, dùng snapshot đối thủ (rOpp, rdOpp), score 1/0
function updateOne(r, rd, rOpp, rdOpp, score) {
  const g = gRD(rdOpp)
  const E = expectedScore(r, rOpp, rdOpp)
  const varInv = Q * Q * g * g * E * (1 - E)
  const invD2 = varInv > 0 ? varInv : 0        // 1/d^2
  const denom = 1 / (rd * rd) + invD2
  const newR = r + (Q / denom) * g * (score - E)
  const newRD = Math.max(RD_FLOOR, Math.sqrt(1 / denom))
  return { r: newR, rd: newRD }
}

export function getTier(rating) {
  if (rating >= 1150) return { key: 'plat',   label: 'Bạch kim', icon: '💎' }
  if (rating >= 1050) return { key: 'gold',   label: 'Vàng',     icon: '🥇' }
  if (rating >= 950)  return { key: 'silver', label: 'Bạc',      icon: '🥈' }
  return { key: 'bronze', label: 'Đồng', icon: '🥉' }
}

export function computeLeaderboard(matches, matchType, people) {
  const P = {} // id -> { r, rd, wins, losses, games }
  const ensure = (id) => {
    if (!P[id]) P[id] = { r: BASE_RATING, rd: BASE_RD, wins: 0, losses: 0, games: 0 }
    return P[id]
  }

  const played = matches
    .filter((m) => m.status === 'completed' && m.winner_side && (!matchType || m.match_type === matchType))
    .sort((a, b) => new Date(a.played_at || a.created_at) - new Date(b.played_at || b.created_at))

  for (const m of played) {
    const isDoubles = m.match_type === 'doubles'

    if (!isDoubles) {
      const a = ensure(m.challenger_id)
      const b = ensure(m.opponent_id)
      const sA = m.winner_side === 'challenger' ? 1 : 0
      const snapA = { r: a.r, rd: a.rd }
      const snapB = { r: b.r, rd: b.rd }
      const ua = updateOne(a.r, a.rd, snapB.r, snapB.rd, sA)
      const ub = updateOne(b.r, b.rd, snapA.r, snapA.rd, 1 - sA)
      a.r = ua.r; a.rd = ua.rd; b.r = ub.r; b.rd = ub.rd
      a.games++; b.games++
      if (sA) { a.wins++; b.losses++ } else { a.losses++; b.wins++ }
    } else {
      const cIds = [m.challenger_id, m.challenger_partner_id].filter(Boolean)
      const oIds = [m.opponent_id, m.opponent_partner_id].filter(Boolean)
      if (cIds.length === 0 || oIds.length === 0) continue
      cIds.forEach(ensure); oIds.forEach(ensure)
      const avg = (ids, key) => ids.reduce((s, id) => s + P[id][key], 0) / ids.length
      const cR = avg(cIds, 'r'), cRD = avg(cIds, 'rd')
      const oR = avg(oIds, 'r'), oRD = avg(oIds, 'rd')
      const sC = m.winner_side === 'challenger' ? 1 : 0

      const updates = []
      cIds.forEach((id) => updates.push([id, updateOne(P[id].r, P[id].rd, oR, oRD, sC)]))
      oIds.forEach((id) => updates.push([id, updateOne(P[id].r, P[id].rd, cR, cRD, 1 - sC)]))
      updates.forEach(([id, u]) => { P[id].r = u.r; P[id].rd = u.rd })

      cIds.forEach((id) => { P[id].games++; if (sC) P[id].wins++; else P[id].losses++ })
      oIds.forEach((id) => { P[id].games++; if (sC) P[id].losses++; else P[id].wins++ })
    }
  }

  const rows = Object.entries(P).map(([id, s]) => {
    const person = people.find((p) => p.id === id) || { id, full_name: '?' }
    const rating = Math.round(s.r)
    const tier = getTier(rating)
    return {
      id,
      full_name:    person.full_name,
      nickname:     person.nickname || null,
      avatar_url:   person.avatar_url || null,
      wins:         s.wins,
      losses:       s.losses,
      total_matches: s.games,
      rating,
      rd:           Math.round(s.rd),
      provisional:  s.rd > PROVISIONAL_RD || s.games < 3,
      tier_key:     tier.key,
      tier_label:   tier.label,
      tier_icon:    tier.icon,
      win_rate:     s.games > 0 ? s.wins / s.games : 0,
      attendance_type: person.attendance_type || null,
      is_guest:     person.attendance_type === 'guest',
    }
  })

  // Người đã ổn định (không tạm tính) xếp trước, theo rating giảm dần.
  rows.sort((a, b) => {
    if (a.provisional !== b.provisional) return a.provisional ? 1 : -1
    return b.rating - a.rating || b.win_rate - a.win_rate || b.total_matches - a.total_matches
  })

  let rank = 0
  return rows.map((r) => (r.provisional ? { ...r, rank: null } : { ...r, rank: ++rank }))
}
