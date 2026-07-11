// Số trận tối thiểu để được xếp hạng chính thức (đủ trận mới "lên bảng").
export const MIN_MATCHES_FOR_RANK = 4

export function wilsonScore(wins, total) {
  if (total === 0) return 0
  const z = 1.96
  const p = wins / total
  const n = total
  const score = (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n)
  return Math.max(0, score)
}

export function computeLeaderboard(matches, matchType, people) {
  const stats = {}
  for (const m of matches) {
    if (m.status !== 'completed' || !m.winner_side) continue
    if (matchType && m.match_type !== matchType) continue

    const players = matchType === 'singles'
      ? [m.challenger_id, m.opponent_id].filter(Boolean)
      : [m.challenger_id, m.challenger_partner_id, m.opponent_id, m.opponent_partner_id].filter(Boolean)

    for (const pid of players) {
      if (!stats[pid]) stats[pid] = { wins: 0, losses: 0 }
    }

    const cWon = m.winner_side === 'challenger'
    const chalIds = [m.challenger_id, matchType === 'doubles' ? m.challenger_partner_id : null].filter(Boolean)
    const oppIds  = [m.opponent_id,   matchType === 'doubles' ? m.opponent_partner_id   : null].filter(Boolean)

    for (const pid of chalIds) { if (stats[pid]) { cWon ? stats[pid].wins++ : stats[pid].losses++ } }
    for (const pid of oppIds)  { if (stats[pid]) { cWon ? stats[pid].losses++ : stats[pid].wins++ } }
  }

  const rows = Object.entries(stats).map(([id, s]) => {
    const total   = s.wins + s.losses
    const person  = people.find((p) => p.id === id) || { id, full_name: '?' }
    const rawPts  = s.wins * 3 - s.losses
    return {
      id,
      full_name:    person.full_name,
      avatar_url:   person.avatar_url || null,
      wins:         s.wins,
      losses:       s.losses,
      total_matches: total,
      points:       Math.max(0, rawPts),
      avg_points:   total > 0 ? rawPts / total : 0,   // điểm trung bình mỗi trận (có thể âm)
      win_rate:     total > 0 ? s.wins / total : 0,
      wilson_score: wilsonScore(s.wins, total),
      attendance_type: person.attendance_type || null,
      is_guest:     person.attendance_type === 'guest',
      qualified:    total >= MIN_MATCHES_FOR_RANK,   // đủ số trận để lên bảng chính
    }
  })

  // Người ĐỦ TRẬN xếp trước (theo điểm TB mỗi trận), người CHƯA ĐỦ TRẬN xuống cuối.
  rows.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1
    return b.avg_points - a.avg_points
      || b.win_rate - a.win_rate
      || b.total_matches - a.total_matches
  })

  // Rank chỉ đánh cho người đủ trận; chưa đủ trận rank = null.
  let rank = 0
  return rows.map((r) => {
    if (r.qualified) { rank += 1; return { ...r, rank } }
    return { ...r, rank: null }
  })
}
