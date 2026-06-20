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
    const total  = s.wins + s.losses
    const person = people.find((p) => p.id === id) || { id, full_name: '?' }
    return {
      id,
      full_name:    person.full_name,
      avatar_url:   person.avatar_url || null,
      wins:         s.wins,
      losses:       s.losses,
      total_matches: total,
      points:       Math.max(0, s.wins * 3 - s.losses),
      win_rate:     total > 0 ? s.wins / total : 0,
      wilson_score: wilsonScore(s.wins, total),
    }
  })

  rows.sort((a, b) => b.wilson_score - a.wilson_score || b.wins - a.wins)
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}
