import { initials } from '../../../../utils/appUtils'

const TIERS = {
  diamond: ['💠', 'Kim cương'],
  platinum: ['💎', 'Bạch kim'],
  gold: ['🥇', 'Vàng'],
  silver: ['🥈', 'Bạc'],
  bronze: ['🥉', 'Đồng'],
}

function TierBadge({ tierKey }) {
  const [icon, label] = TIERS[tierKey] || TIERS.bronze
  return <span className="lb-tier-badge" title={label}>{icon} <span className="lb-tier-name">{label}</span></span>
}

export function PersonCell({ p }) {
  if (!p) return <span className="muted">–</span>
  return (
    <div className="pk-person-cell">
      {p.avatar_url
        ? <img src={p.avatar_url} className="avatar avatar-img pk-avatar" alt={p.full_name} />
        : <span className="avatar pk-avatar">{initials(p.full_name)}</span>}
      <span>{p.full_name}{p.attendance_type === 'guest' && <small className="lb-guest-tag">Vãng lai</small>}</span>
    </div>
  )
}

export function AdminLeaderboardRow({ row }) {
  return (
    <tr>
      <td><span className="lb-rank-num">{row.rank}</span></td>
      <td><PersonCell p={row} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td><TierBadge tierKey={row.tier_key} /></td>
    </tr>
  )
}

export function AdminLeaderboardLegend() {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item">💠 Kim cương</span>
      <span className="lb-legend-item">💎 Bạch kim</span>
      <span className="lb-legend-item">🥇 Vàng</span>
      <span className="lb-legend-item">🥈 Bạc</span>
      <span className="lb-legend-item">🥉 Đồng</span>
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">Điểm mùa được ẩn; đánh đơn và đánh đôi được tính riêng.</span>
    </div>
  )
}

export function AdminQualifyingPlayers({ rows }) {
  if (!rows?.length) return null
  return (
    <div className="lb-qualifying">
      <h3>Chưa đủ điều kiện xếp hạng</h3>
      <div className="lb-qualifying-list">
        {rows.map((row) => (
          <div className="lb-qualifying-row" key={row.id}>
            <PersonCell p={row} />
            <span className="muted">
              {row.matches_needed > 0 && `Thiếu ${row.matches_needed} trận`}
              {row.matches_needed > 0 && row.opponents_needed > 0 && ' · '}
              {row.opponents_needed > 0 && `Thiếu ${row.opponents_needed} đối thủ`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
