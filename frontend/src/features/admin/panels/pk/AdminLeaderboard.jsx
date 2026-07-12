import { initials } from '../../../../utils/appUtils'

function TierBadge({ icon, label }) {
  return <span className="lb-tier-badge" title={label}>{icon} <span className="lb-tier-name">{label}</span></span>
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

export function AdminLeaderboardRow({ row }) {
  return (
    <tr className={row.provisional ? 'lb-row-unqualified' : ''}>
      <td>{row.rank ? <span className="lb-rank-num">{row.rank}</span> : <span className="lb-rank-num muted">–</span>}</td>
      <td><PersonCell p={row} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td><TierBadge icon={row.tier_icon} label={row.tier_label} /></td>
      <td className="lb-rating">
        <strong>{row.rating}</strong>
        {row.provisional && <small className="muted lb-prov"> tạm tính</small>}
      </td>
    </tr>
  )
}

export function AdminLeaderboardLegend() {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item">💎 Bạch kim</span>
      <span className="lb-legend-item">🥇 Vàng</span>
      <span className="lb-legend-item">🥈 Bạc</span>
      <span className="lb-legend-item">🥉 Đồng</span>
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">Rating Glicko — thắng người mạnh cộng nhiều; người mới hiện "tạm tính"</span>
    </div>
  )
}
