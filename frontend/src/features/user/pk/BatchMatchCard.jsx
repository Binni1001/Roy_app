import { initials } from '../../../utils/appUtils'

/* Card 1 trận đã chốt (dùng cho reveal + danh sách cuối của ghép nhiều trận) */
export function BatchMatchCard({ match, index, onRemove }) {
  const isDoubles = match.match_type === 'doubles'
  return (
    <div className="rm-mcard">
      <span className="rm-mcard-no">{index + 1}</span>
      <div className="rm-mcard-body">
        <div className="rm-mcard-team">
          {[match.challenger, match.challenger_partner].filter(Boolean).map((p) => (
            <div key={p.id} className="rm-mcard-player">
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.full_name} className="rm-mcard-ava avatar-img" />
                : <span className="rm-mcard-ava rm-mcard-ava-init">{initials(p.full_name)}</span>}
              <span className="rm-mcard-name">{p.full_name}</span>
            </div>
          ))}
        </div>
        <div className="rm-mcard-vs">
          <span className="rm-mcard-vs-text">VS</span>
          <span className="rm-mcard-type">{isDoubles ? 'Đôi' : 'Đơn'}</span>
        </div>
        <div className="rm-mcard-team rm-mcard-team-right">
          {[match.opponent, match.opponent_partner].filter(Boolean).map((p) => (
            <div key={p.id} className="rm-mcard-player">
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.full_name} className="rm-mcard-ava avatar-img" />
                : <span className="rm-mcard-ava rm-mcard-ava-init">{initials(p.full_name)}</span>}
              <span className="rm-mcard-name">{p.full_name}</span>
            </div>
          ))}
        </div>
      </div>
      {onRemove && (
        <button className="rm-mcard-remove" onClick={onRemove} title="Bỏ trận này">×</button>
      )}
    </div>
  )
}
