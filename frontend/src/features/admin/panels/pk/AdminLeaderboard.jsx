import { SeasonTierBadge } from '../../../../components/SeasonTierBadge'
import { SeasonAchievementMarks } from '../../../../components/SeasonAchievements'
import { initials } from '../../../../utils/appUtils'

export function PersonCell({ p, achievements }) {
  if (!p) return <span className="muted">–</span>
  return (
    <div className="pk-person-cell">
      {p.avatar_url
        ? <img src={p.avatar_url} className="avatar avatar-img pk-avatar" alt={p.full_name} />
        : <span className="avatar pk-avatar">{initials(p.full_name)}</span>}
      <span>
        <span className="pk-person-name">{p.full_name}</span>
        {p.attendance_type === 'guest' && <small className="lb-guest-tag">Vãng lai</small>}
        <SeasonAchievementMarks personId={p.id} achievements={achievements} />
      </span>
    </div>
  )
}

export function AdminLeaderboardRow({ row, achievements }) {
  return (
    <tr className={row.tier_key === 'champion' ? 'lb-row-champion' : ''}>
      <td><span className="lb-rank-num">{row.rank}</span></td>
      <td><PersonCell p={row} achievements={achievements} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td><SeasonTierBadge tierKey={row.tier_key} showLabel={false} /></td>
      <td className="lb-points"><strong>{Number(row.points || 0).toLocaleString('vi-VN')}</strong></td>
    </tr>
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
