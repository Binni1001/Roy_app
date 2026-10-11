import { formatDate, initials } from '../../../../utils/appUtils'
import { STATUS_LABEL } from './pkConstants'
import { MatchSetScores } from '../../../user/pk/PkScores'

function FightAvatar({ person, size = 'lg' }) {
  const className = `pk-fight-ava pk-fight-ava-${size}`
  if (!person) return <div className={`${className} pk-fight-ava-empty`}>?</div>
  if (person.avatar_url) {
    return <img src={person.avatar_url} alt={person.full_name} className={`${className} avatar-img`} />
  }
  return <div className={className}>{initials(person.full_name)}</div>
}

function FightTeam({ main, partner, role, side, isWinner }) {
  const isDoubles = Boolean(partner)
  return (
    <div className={`pk-fight-team pk-fight-team-${side}${isWinner ? ' pk-fight-winner' : ''}`}>
      {isWinner && <span className="pk-fight-ribbon">🏆 THẮNG</span>}
      <div className="pk-fight-avatars">
        <FightAvatar person={main} size={isDoubles ? 'lg' : 'xl'} />
        {partner && <FightAvatar person={partner} size="sm" />}
      </div>
      <div className="pk-fight-names">
        <span className="pk-fight-name">{(main?.full_name || '?').toUpperCase()}</span>
        {partner && <span className="pk-fight-partner">&amp; {partner.full_name}</span>}
      </div>
      <span className="pk-fight-role">{role}</span>
    </div>
  )
}

function FightCenter({ match, showResult }) {
  let challengerSets = 0
  let opponentSets = 0
  for (const score of match.set_scores || []) {
    if (score.challenger > score.opponent) challengerSets += 1
    if (score.opponent > score.challenger) opponentSets += 1
  }

  return (
    <div className="pk-fight-center">
      <div className="pk-fight-net" aria-hidden="true" />
      <div className="pk-fight-vs">ĐẤU</div>
      {showResult && match.set_scores?.length > 0 && (
        <div className="pk-fight-score">
          {match.set_scores?.length
            ? <>{challengerSets}<span>–</span>{opponentSets}</>
            : null}
        </div>
      )}
      {showResult && match.set_scores?.length > 0 && <small className="pk-set-total-note">set thắng</small>}
      {showResult && <MatchSetScores scores={match.set_scores} />}
    </div>
  )
}

export function AdminMatchCard({ m, displayNumber, onEdit, onDelete, onFinalize, onVoid, onCorrectResult, canVoid, readOnly = false }) {
  const isVoided = Boolean(m.voided_at)
  const showResult = m.status === 'completed' && !isVoided
  const visualStatus = isVoided ? 'cancelled' : m.status

  return (
    <div className={`pk-fight-card pk-fight-${visualStatus}`}>
      <div className="pk-fight-head">
        <div className="pk-fight-head-left">
          {displayNumber != null && <span className="pk-fight-no">Trận {displayNumber}</span>}
          <span className={`pk-badge pk-badge-${visualStatus}`}>
            {isVoided ? 'Kết quả đã hủy' : STATUS_LABEL[m.status]}
          </span>
          <span className="pk-badge pk-badge-type">{m.match_type === 'singles' ? 'Đơn' : 'Đôi'}</span>
          {m.sets > 1 && <span className="pk-badge pk-badge-sets">{m.sets} ván</span>}
        </div>
        {m.played_at && <span className="pk-fight-date">📅 {formatDate(m.played_at)}</span>}
      </div>

      <div className="pk-fight-body">
        <FightTeam
          main={m.challenger}
          partner={m.challenger_partner}
          role="Thách đấu"
          side="a"
          isWinner={showResult && m.winner_side === 'challenger'}
        />
        <FightCenter match={m} showResult={showResult} />
        <FightTeam
          main={m.opponent}
          partner={m.opponent_partner}
          role="Đối thủ"
          side="b"
          isWinner={showResult && m.winner_side === 'opponent'}
        />
      </div>

      <div className="pk-fight-foot">
        <div className="pk-fight-foot-info">
          {m.bet_items && <span className="pk-fight-bet">🎁 {m.bet_items}</span>}
          {m.note && <span className="pk-fight-note muted">{m.note}</span>}
          {isVoided && m.void_reason && <span className="pk-fight-note muted">Lý do: {m.void_reason}</span>}
        </div>
        {!readOnly && <div className="pk-fight-actions">
          {showResult && <button onClick={() => onCorrectResult(m)}>Sửa tỷ số</button>}
          {(m.status === 'pending' || m.status === 'active') && (
            <button onClick={() => onFinalize(m)}>Ghi kết quả</button>
          )}
          {!isVoided && <button onClick={() => onEdit(m)}>Sửa trận</button>}
          {m.status !== 'completed' && (
            <button className="danger" onClick={() => onDelete(m)}>Xóa trận</button>
          )}
          {m.status === 'completed' && !isVoided && canVoid && (
            <button className="danger" onClick={() => onVoid(m)}>Hủy kết quả</button>
          )}
        </div>}
      </div>
    </div>
  )
}
