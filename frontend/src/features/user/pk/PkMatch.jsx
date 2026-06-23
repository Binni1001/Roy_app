import { useState } from 'react'
import { Modal } from '../../../components/common'
import { formatDate, initials } from '../../../utils/appUtils'
import { STATUS_LABEL, getResultLock, isParticipant } from './pkUtils'

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
  if (!scores || scores.length === 0) return null
  return (
    <div className="pk-set-scores">
      {scores.map((s, i) => (
        <div key={i} className="pk-set-row">
          <span className="pk-set-label">Set {i + 1}</span>
          <span className={`pk-set-score${s.challenger > s.opponent ? ' pk-score-win' : ' pk-score-lose'}`}>{s.challenger}</span>
          <span className="pk-set-dash">–</span>
          <span className={`pk-set-score${s.opponent > s.challenger ? ' pk-score-win' : ' pk-score-lose'}`}>{s.opponent}</span>
        </div>
      ))}
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

export function MatchCard({ m, activePerson, onSetResult, onCancel, onStart, onEdit }) {
  const amParticipant = isParticipant(m, activePerson)
  const { canRecord, reason } = getResultLock(m)
  const challengerWon = m.winner_side === 'challenger'
  const opponentWon   = m.winner_side === 'opponent'

  return (
    <div className={`pk-match-card pk-match-card-v2 pk-status-${m.status}`}>
      <div className="pk-card-header">
        <span className={`pk-badge pk-badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
        <span className="pk-badge pk-badge-type">{m.match_type === 'singles' ? '⚔ Đơn' : '🤝 Đôi'}</span>
        {m.sets && m.sets > 1 && <span className="pk-badge pk-badge-sets">Bo{m.sets}</span>}
        {m.played_at && <span className="pk-card-date">📅 {formatDate(m.played_at)}</span>}
      </div>

      <div className="pk-card-vs-row">
        <TeamBlock main={m.challenger} partner={m.challenger_partner} label="Thách đấu" isWinner={m.status === 'completed' && challengerWon} />
        <div className="pk-vs-center">
          <span className="pk-vs-text">VS</span>
          {m.status === 'completed' && <SetScores scores={m.set_scores} />}
        </div>
        <TeamBlock main={m.opponent} partner={m.opponent_partner} label="Đối thủ" isWinner={m.status === 'completed' && opponentWon} />
      </div>

      {(m.bet_items || m.note || amParticipant) && (
        <div className="pk-card-footer">
          {m.bet_items && <span className="pk-bet">🎁 {m.bet_items}</span>}
          {m.note      && <span className="pk-note muted">{m.note}</span>}

          {amParticipant && m.status !== 'cancelled' && (
            <div className="pk-match-actions">
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
            <span className="rs-side-name">{cName}</span>
            <small>Bên thách đấu</small>
            {winner === 'challenger' && <span className="rs-crown">🏆</span>}
          </button>
          <span className="rs-vs">VS</span>
          <button type="button"
            className={`rs-side-btn${winner === 'opponent' ? ' rs-side-active' : ''}`}
            onClick={() => setWinner('opponent')}>
            <span className="rs-side-name">{oName}</span>
            <small>Bên đối thủ</small>
            {winner === 'opponent' && <span className="rs-crown">🏆</span>}
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
