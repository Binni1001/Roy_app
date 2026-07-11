import { initials } from '../../../../utils/appUtils'
import { MIN_MATCHES_FOR_RANK } from '../../../../utils/leaderboardUtils'

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

function AvgPointsCell({ value, qualified }) {
  if (!qualified) return <small className="muted">Chưa đủ {MIN_MATCHES_FOR_RANK} trận</small>
  const v = value || 0
  const txt = (v >= 0 ? '+' : '') + v.toFixed(1)
  const color = v > 0.5 ? '#5ee0a8' : v < 0 ? '#f08a8a' : '#f0d486'
  return <strong className="lb-avg" style={{ color }}>{txt}<small className="muted"> đ/trận</small></strong>
}

export function PersonCell({ p }) {
  if (!p) return <span className="muted">—</span>
  return (
    <div className="pk-person-cell">
      {p.avatar_url
        ? <img src={p.avatar_url} className="avatar avatar-img pk-avatar" alt={p.full_name} />
        : <span className="avatar pk-avatar">{initials(p.full_name)}</span>}
      <span>{p.full_name}{p.is_guest && <small className="lb-guest-tag">Vãng lai</small>}</span>
    </div>
  )
}

export function AdminLeaderboardRow({ row, total }) {
  return (
    <tr className={row.qualified ? getTierCls(row.rank, total) : 'lb-row-unqualified'}>
      <td>{row.rank ? <RankBadge rank={row.rank} total={total} /> : <span className="lb-rank-num muted">–</span>}</td>
      <td><PersonCell p={row} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td className="lb-points"><span className="lb-points-chip">{row.points ?? 0}</span></td>
      <td><AvgPointsCell value={row.avg_points} qualified={row.qualified} /></td>
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
      <span className="lb-legend-hint">Xếp theo điểm TB mỗi trận · cần ≥ {MIN_MATCHES_FOR_RANK} trận</span>
    </div>
  )
}
