import { useState } from 'react'
import { Modal } from '../../../components/common'
import { formatDate, initials } from '../../../utils/appUtils'
import { STATUS_LABEL, getResultLock, isParticipant, getWinnerSide } from './pkUtils'

/* Avatar trong fight card — size: xl (đơn) | lg (đội chính) | sm (đồng đội) */
function FightAvatar({ person, size = 'lg' }) {
  const cls = `pk-fight-ava pk-fight-ava-${size}`
  if (!person) return <div className={`${cls} pk-fight-ava-empty`}>?</div>
  if (person.avatar_url) return <img src={person.avatar_url} alt={person.full_name} className={`${cls} avatar-img`} />
  return <div className={cls}>{initials(person.full_name)}</div>
}

/* Một phe (đội) trong fight card */
function FightTeam({ main, partner, role, side, isWinner }) {
  const isDoubles = !!partner
  return (
    <div className={`pk-fight-team pk-fight-team-${side}${isWinner ? ' pk-fight-winner' : ''}`}>
      {isWinner && <span className="pk-fight-ribbon">🏆 WINNER</span>}
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

/* Khu vực giữa: badge VS + tỉ số set nếu đã kết thúc */
function FightCenter({ m }) {
  const completed = m.status === 'completed'
  let cWon = 0, oWon = 0
  if (m.set_scores?.length) {
    for (const s of m.set_scores) {
      if (s.challenger > s.opponent) cWon++
      else if (s.opponent > s.challenger) oWon++
    }
  }
  return (
    <div className="pk-fight-center">
      <div className="pk-fight-net" aria-hidden="true" />
      <div className="pk-fight-vs">VS</div>
      {completed && (
        m.set_scores?.length
          ? <div className="pk-fight-score">{cWon}<span>–</span>{oWon}</div>
          : <div className="pk-fight-score">{m.winner_side === 'challenger' ? '1–0' : '0–1'}</div>
      )}
    </div>
  )
}

export function UserEditModal({ match, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    played_at: match.played_at ? match.played_at.slice(0, 10) : '',
    bet_items: match.bet_items || '',
    note:      match.note      || '',
    sets:      match.sets      || 1,
  })
  function upd(k, v) { setDraft((d) => ({ ...d, [k]: v })) }
  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ played_at: draft.played_at || null, bet_items: draft.bet_items || null, note: draft.note || null, sets: Number(draft.sets) || 1 })
  }
  return (
    <Modal title="✏️ Sửa kèo" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label>📅 Ngày đấu
          <input type="date" value={draft.played_at} onChange={(e) => upd('played_at', e.target.value)} />
        </label>
        <div className="ck-sets-row" style={{ margin: '10px 0' }}>
          <span className="ck-sets-label">🏸 Số set</span>
          <div className="ck-sets-options">
            {[1, 3, 5].map((s) => (
              <button key={s} type="button"
                className={`ck-set-btn${draft.sets === s ? ' ck-set-active' : ''}`}
                onClick={() => upd('sets', s)}>{s} set</button>
            ))}
          </div>
        </div>
        <label>🎁 Vật phẩm cược
          <input type="text" value={draft.bet_items} onChange={(e) => upd('bet_items', e.target.value)} placeholder="VD: 2 chai nước" />
        </label>
        <label>📝 Ghi chú
          <input type="text" value={draft.note} onChange={(e) => upd('note', e.target.value)} placeholder="Tuỳ chọn" />
        </label>
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

export function MatchCard({ m, activePerson, matchNumber, onSetResult, onCancel, onStart, onEdit }) {
  const amParticipant = isParticipant(m, activePerson)
  const { canRecord, reason } = getResultLock(m)
  const winner = getWinnerSide(m)
  const showActions = amParticipant && m.status !== 'cancelled'

  return (
    <div className={`pk-fight-card pk-fight-${m.status}`}>
      <div className="pk-fight-head">
        <div className="pk-fight-head-left">
          {matchNumber != null && <span className="pk-fight-no">Trận {matchNumber}</span>}
          <span className={`pk-badge pk-badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
          <span className="pk-badge pk-badge-type">{m.match_type === 'singles' ? '🏸 Đơn' : '👥 Đôi'}</span>
          {m.sets && m.sets > 1 && <span className="pk-badge pk-badge-sets">Bo{m.sets}</span>}
        </div>
        {m.played_at && <span className="pk-fight-date">📅 {formatDate(m.played_at)}</span>}
      </div>

      <div className="pk-fight-body">
        <FightTeam main={m.challenger} partner={m.challenger_partner} role="Thách đấu" side="a" isWinner={winner === 'challenger'} />
        <FightCenter m={m} />
        <FightTeam main={m.opponent} partner={m.opponent_partner} role="Đối thủ" side="b" isWinner={winner === 'opponent'} />
      </div>

      {(m.bet_items || m.note || showActions) && (
        <div className="pk-fight-foot">
          <div className="pk-fight-foot-info">
            {m.bet_items && <span className="pk-fight-bet">🎁 {m.bet_items}</span>}
            {m.note && <span className="pk-fight-note muted">{m.note}</span>}
          </div>

          {showActions && (
            <div className="pk-fight-actions">
              {m.status === 'pending' && (
                <button className="btn-start" onClick={() => onStart(m.id)}>▶ Bắt đầu đấu</button>
              )}
              {(m.status === 'pending' || m.status === 'active') && (
                <span title={!canRecord ? reason : undefined}>
                  <button onClick={() => onSetResult(m)} disabled={!canRecord}>Ghi kết quả</button>
                </span>
              )}
              {(m.status === 'pending' || m.status === 'active') && !canRecord && reason && (
                <small className="muted pk-lock-hint">{reason}</small>
              )}
              {m.status === 'completed' && canRecord && (
                <button onClick={() => onSetResult(m)}>Sửa kết quả</button>
              )}
              <button onClick={() => onEdit(m)}>Sửa kèo</button>
              {m.status === 'pending' && (
                <button className="danger" onClick={() => onCancel(m.id)}>Hủy kèo</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ResultModal({ match, onClose, onSubmit }) {
  const sets = match.sets || 1
  const [winner, setWinner] = useState('')
  const [scores, setScores] = useState(
    Array.from({ length: sets }, () => ({ challenger: '', opponent: '' }))
  )
  const [confirming, setConfirming] = useState(false)

  function updateScore(i, side, val) {
    setScores((prev) => prev.map((s, idx) => idx === i ? { ...s, [side]: val } : s))
  }
  function addSet() { setScores((prev) => [...prev, { challenger: '', opponent: '' }]) }
  function removeSet(i) { setScores((prev) => prev.filter((_, idx) => idx !== i)) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!winner) return
    setConfirming(true)
  }

  function handleConfirm() {
    const parsed = scores.map((s) => ({
      challenger: Number(s.challenger) || 0,
      opponent: Number(s.opponent) || 0,
    })).filter((s) => s.challenger > 0 || s.opponent > 0)
    onSubmit(winner, parsed)
  }

  const cName = `${match.challenger?.full_name || '?'}${match.challenger_partner ? ` & ${match.challenger_partner.full_name}` : ''}`
  const oName = `${match.opponent?.full_name || '?'}${match.opponent_partner ? ` & ${match.opponent_partner.full_name}` : ''}`
  const winnerName = winner === 'challenger' ? cName : winner === 'opponent' ? oName : ''

  if (confirming) {
    return (
      <Modal title="⚠️ Xác nhận kết quả" onClose={() => setConfirming(false)}>
        <div className="rs-root">
          <div className="rs-confirm-box">
            <p className="rs-confirm-winner">🏆 <strong>{winnerName}</strong> thắng</p>
            <p className="rs-confirm-warn">Sau khi xác nhận, kết quả sẽ bị khoá sau <strong>24 giờ</strong> và không thể chỉnh sửa.</p>
          </div>
          <footer className="modal-actions">
            <button type="button" onClick={() => setConfirming(false)}>Quay lại</button>
            <button type="button" className="btn-danger" onClick={handleConfirm}>Xác nhận</button>
          </footer>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="🏆 Ghi nhận kết quả" onClose={onClose}>
      <form className="rs-root" onSubmit={handleSubmit}>
        <p className="rs-hint">Chọn bên thắng</p>
        <div className="rs-winner-row">
          <button type="button"
            className={`rs-side-btn${winner === 'challenger' ? ' rs-side-active' : ''}`}
            onClick={() => setWinner('challenger')}>
            {winner === 'challenger' && <span className="rs-check">✓</span>}
            <div className="rs-side-avas">
              <FightAvatar person={match.challenger} size="sm" />
              {match.challenger_partner && <FightAvatar person={match.challenger_partner} size="sm" />}
            </div>
            <span className="rs-side-name">{cName}</span>
            <small className="rs-side-role">Bên thách đấu</small>
          </button>
          <span className="rs-vs">VS</span>
          <button type="button"
            className={`rs-side-btn${winner === 'opponent' ? ' rs-side-active' : ''}`}
            onClick={() => setWinner('opponent')}>
            {winner === 'opponent' && <span className="rs-check">✓</span>}
            <div className="rs-side-avas">
              <FightAvatar person={match.opponent} size="sm" />
              {match.opponent_partner && <FightAvatar person={match.opponent_partner} size="sm" />}
            </div>
            <span className="rs-side-name">{oName}</span>
            <small className="rs-side-role">Bên đối thủ</small>
          </button>
        </div>

        <div className="rs-scores">
          <div className="rs-scores-header">
            <span>Set</span>
            <span>{match.challenger?.full_name?.split(' ').pop() || 'Thách đấu'}</span>
            <span></span>
            <span>{match.opponent?.full_name?.split(' ').pop() || 'Đối thủ'}</span>
          </div>
          {scores.map((s, i) => (
            <div key={i} className="rs-score-row">
              <span className="rs-set-num">Set {i + 1}</span>
              <input className="rs-score-input" type="number" min="0" max="99"
                value={s.challenger} onChange={(e) => updateScore(i, 'challenger', e.target.value)}
                placeholder="0" />
              <span className="rs-dash">–</span>
              <input className="rs-score-input" type="number" min="0" max="99"
                value={s.opponent} onChange={(e) => updateScore(i, 'opponent', e.target.value)}
                placeholder="0" />
              {scores.length > 1 && (
                <button type="button" className="rs-remove-set" onClick={() => removeSet(i)} title="Xóa set này">×</button>
              )}
            </div>
          ))}
          <button type="button" className="rs-add-set" onClick={addSet}>+ Thêm set</button>
        </div>

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={!winner}>Tiếp theo →</button>
        </footer>
      </form>
    </Modal>
  )
}
