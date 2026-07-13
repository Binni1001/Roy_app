import { ActionGroup } from '../../../../components/common'
import { formatDate, initials } from '../../../../utils/appUtils'
import { STATUS_LABEL } from './pkConstants'

function Avatar({ person, size = 'md' }) {
  const cls = size === 'lg' ? 'pk-avatar-lg' : 'pk-avatar-sm'
  if (!person) return <div className={`pk-avatar-circle ${cls} muted`}>?</div>
  if (person.avatar_url) return <img src={person.avatar_url} alt={person.full_name} className={`pk-avatar-circle ${cls} avatar-img`} />
  return <div className={`pk-avatar-circle ${cls}`}>{initials(person.full_name)}</div>
}

function TeamBlock({ main, partner, label, isWinner }) {
  return (
    <div className={`pk-team-block${isWinner ? ' pk-winner-side' : ''}`}>
      <div className="pk-team-avatars">
        <Avatar person={main} size="lg" />
        {partner && <Avatar person={partner} size="md" />}
      </div>
      <div className="pk-team-names">
        <strong>{main?.full_name || '?'}</strong>
        {partner && <span className="pk-partner-name">& {partner.full_name}</span>}
      </div>
      <span className="pk-team-label">{label}</span>
      {isWinner && <span className="pk-crown">🏆</span>}
    </div>
  )
}

function SetScores({ scores }) {
  if (!scores?.length) return null
  return (
    <div className="pk-set-scores">
      {scores.map((s, i) => {
        const cWins = s.challenger > s.opponent
        return (
          <div key={i} className="pk-set-row">
            <span className={`pk-set-score ${cWins ? 'pk-score-win' : 'pk-score-lose'}`}>{s.challenger}</span>
            <span className="pk-set-label">–</span>
            <span className={`pk-set-score ${!cWins ? 'pk-score-win' : 'pk-score-lose'}`}>{s.opponent}</span>
          </div>
        )
      })}
    </div>
  )
}

export function AdminMatchCard({ m, onEdit, onDelete, onFinalize, onVoid, canVoid }) {
  const challengerWon = m.winner_side === 'challenger'
  const opponentWon   = m.winner_side === 'opponent'

  return (
    <div className={`pk-match-card pk-match-card-v2 pk-status-${m.status}`}>
      <div className="pk-card-header">
        {m.match_number && <span className="pk-fight-no">Trận {m.match_number}</span>}
        <span className={`pk-badge pk-badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
        {m.voided_at && <span className="pk-badge pk-badge-cancelled">Kết quả đã hủy</span>}
        <span className="pk-badge pk-badge-type">{m.match_type === 'singles' ? 'Đơn' : 'Đôi'}</span>
        {m.sets && m.sets > 1 && <span className="pk-badge pk-badge-sets">Bo{m.sets}</span>}
        {m.played_at && <span className="pk-card-date">📅 {formatDate(m.played_at)}</span>}
      </div>

      <div className="pk-card-vs-row">
        <TeamBlock
          main={m.challenger}
          partner={m.challenger_partner}
          label="Thách đấu"
          isWinner={m.status === 'completed' && challengerWon}
        />
        <div className="pk-vs-center">
          <span className="pk-vs-text">ĐẤU</span>
          {m.status === 'completed' && (
            m.set_scores?.length
              ? <SetScores scores={m.set_scores} />
              : <span className="pk-score-label">{challengerWon ? '1 – 0' : '0 – 1'}</span>
          )}
        </div>
        <TeamBlock
          main={m.opponent}
          partner={m.opponent_partner}
          label="Đối thủ"
          isWinner={m.status === 'completed' && opponentWon}
        />
      </div>

      <div className="pk-card-footer">
        {m.bet_items && <span className="pk-bet">🎁 {m.bet_items}</span>}
        {m.note      && <span className="pk-note muted">{m.note}</span>}
        <div className="pk-match-actions">
          <ActionGroup>
            {(m.status === 'pending' || m.status === 'active') && (
              <button onClick={() => onFinalize(m)}>Ghi kết quả</button>
            )}
            {m.status !== 'completed' && (
              <button onClick={() => onEdit(m)}>Sửa</button>
            )}
            {m.status !== 'completed' && (
              <button className="danger" onClick={() => onDelete(m)}>Xóa</button>
            )}
            {m.status === 'completed' && !m.voided_at && canVoid && (
              <button className="danger" onClick={() => onVoid(m)}>Hủy kết quả</button>
            )}
          </ActionGroup>
        </div>
      </div>
    </div>
  )
}
