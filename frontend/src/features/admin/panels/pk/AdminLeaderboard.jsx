import { initials } from '../../../../utils/appUtils'

export function getTierCls(rank, total) {
  if (rank === 1) return 'lb-tier-gold'
  if (rank === 2) return 'lb-tier-silver'
  if (rank === 3) return 'lb-tier-bronze'
  if (total >= 5 && rank >= total - 1) return 'lb-tier-bottom'
  return ''
}

function RankBadge({ rank, total }) {
  if (rank === 1) return <span className="lb-rank-badge lb-gold">🥇</span>
  if (rank === 2) return <span className="lb-rank-badge lb-silver">🥈</span>
  if (rank === 3) return <span className="lb-rank-badge lb-bronze">🥉</span>
  if (total >= 5 && rank === total) return <span className="lb-rank-badge lb-last">💀</span>
  if (total >= 5 && rank === total - 1) return <span className="lb-rank-badge lb-near-last">😅</span>
  return <span className="lb-rank-num">{rank}</span>
}

function WilsonBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score || 0) * 100))
  let cls = 'lb-bar-low'
  if (pct >= 60) cls = 'lb-bar-high'
  else if (pct >= 40) cls = 'lb-bar-mid'
  const display = Math.round(pct)
  return (
    <div className="lb-bar-wrap" title={`${display}%`}>
      <div className={`lb-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      <span className="lb-bar-label">{display}%</span>
    </div>
  )
}

export function PersonCell({ p }) {
  if (!p) return <span className="muted">—</span>
  return (
    <div className="pk-person-cell">
      {p.avatar_url
        ? <img src={p.avatar_url} className="avatar avatar-img pk-avatar" alt={p.full_name} />
        : <span className="avatar pk-avatar">{initials(p.full_name)}</span>}
      <span>{p.full_name}</span>
    </div>
  )
}

export function AdminLeaderboardRow({ row, total }) {
  return (
    <tr className={getTierCls(row.rank, total)}>
      <td><RankBadge rank={row.rank} total={total} /></td>
      <td><PersonCell p={row} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td className="lb-points"><span className="lb-points-chip">{row.points ?? 0}</span></td>
      <td><WilsonBar score={row.wilson_score} /></td>
    </tr>
  )
}

export function AdminLeaderboardLegend({ total }) {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item"><span className="lb-dot lb-dot-gold" />Top 3</span>
      <span className="lb-legend-item"><span className="lb-dot lb-dot-mid" />Trung bình</span>
      {total >= 5 && <span className="lb-legend-item"><span className="lb-dot lb-dot-bottom" />Cần cố gắng</span>}
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">★ Wilson Score — đánh nhiều trận mới cao</span>
    </div>
  )
}
