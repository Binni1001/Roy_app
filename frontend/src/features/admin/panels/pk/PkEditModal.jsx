import { useState } from 'react'
import { Modal } from '../../../../components/common'
import { STATUS_LABEL, STATUS_OPTIONS } from './pkConstants'

/* Modal admin sửa kèo — chỉnh mọi trường + điểm từng set */
export function PkEditModal({ match, people = [], onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    match_type:             match.match_type             || 'singles',
    sets:                   match.sets                   || 1,
    challenger_id:          match.challenger_id          || '',
    opponent_id:            match.opponent_id            || '',
    challenger_partner_id:  match.challenger_partner_id  || '',
    opponent_partner_id:    match.opponent_partner_id    || '',
    status:                 match.status                 || 'pending',
    winner_side:            match.winner_side            || '',
    bet_items:              match.bet_items              || '',
    played_at:              match.played_at ? match.played_at.slice(0, 10) : '',
    note:                   match.note                   || '',
  })
  const [scores, setScores] = useState(
    match.set_scores?.length
      ? match.set_scores.map((s) => ({ challenger: s.challenger ?? '', opponent: s.opponent ?? '' }))
      : Array.from({ length: match.sets || 1 }, () => ({ challenger: '', opponent: '' }))
  )

  function update(k, v) { setDraft((d) => ({ ...d, [k]: v })) }
  function updateScore(i, side, val) {
    setScores((prev) => prev.map((s, idx) => idx === i ? { ...s, [side]: val } : s))
  }
  function addSet() { setScores((prev) => [...prev, { challenger: '', opponent: '' }]) }
  function removeSet(i) { setScores((prev) => prev.filter((_, idx) => idx !== i)) }

  function handleSubmit(e) {
    e.preventDefault()
    const parsed = scores
      .map((s) => ({ challenger: Number(s.challenger) || 0, opponent: Number(s.opponent) || 0 }))
      .filter((s) => s.challenger > 0 || s.opponent > 0)
    const isDoublesVal = draft.match_type === 'doubles'
    onSubmit({
      match_type:             draft.match_type,
      sets:                   Number(draft.sets) || 1,
      challenger_id:          draft.challenger_id         || null,
      opponent_id:            draft.opponent_id           || null,
      challenger_partner_id:  isDoublesVal ? (draft.challenger_partner_id || null) : null,
      opponent_partner_id:    isDoublesVal ? (draft.opponent_partner_id   || null) : null,
      status:                 draft.status,
      winner_side:            draft.winner_side           || null,
      bet_items:              draft.bet_items             || null,
      played_at:              draft.played_at             || null,
      note:                   draft.note                  || null,
      set_scores:             parsed.length ? parsed : null,
    })
  }

  const isDoubles = draft.match_type === 'doubles'
  const challName = people.find((p) => p.id === draft.challenger_id)?.full_name?.split(' ').pop() || 'Thách đấu'
  const oppName   = people.find((p) => p.id === draft.opponent_id)?.full_name?.split(' ').pop()   || 'Đối thủ'

  return (
    <Modal title="✏️ Sửa kèo đấu (Admin)" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>

        {/* Loại kèo */}
        <div className="ck-type-toggle" style={{ marginBottom: 12 }}>
          <button type="button" className={`ck-type-btn${!isDoubles ? ' ck-type-active' : ''}`}
            onClick={() => update('match_type', 'singles')}>
            <span className="ck-type-icon">⚔️</span><strong>Đơn</strong>
          </button>
          <button type="button" className={`ck-type-btn${isDoubles ? ' ck-type-active' : ''}`}
            onClick={() => update('match_type', 'doubles')}>
            <span className="ck-type-icon">🤝</span><strong>Đôi</strong>
          </button>
        </div>

        {/* Số set */}
        <div className="ck-sets-row" style={{ marginBottom: 12 }}>
          <span className="ck-sets-label">🏸 Số set</span>
          <div className="ck-sets-options">
            {[1, 3, 5].map((s) => (
              <button key={s} type="button"
                className={`ck-set-btn${draft.sets === s ? ' ck-set-active' : ''}`}
                onClick={() => update('sets', s)}>{s} set</button>
            ))}
          </div>
        </div>

        {/* Người chơi */}
        <div className="ck-vs-row" style={{ marginBottom: 12 }}>
          <div className="ck-team">
            <div className="ck-team-label ck-label-blue">🧑 Thách đấu</div>
            <select className="ck-select" value={draft.challenger_id} onChange={(e) => update('challenger_id', e.target.value)}>
              <option value="">Chọn người</option>
              {people.filter((p) => p.id !== draft.opponent_id && p.id !== draft.opponent_partner_id)
                .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
            </select>
            {isDoubles && (
              <select className="ck-select" value={draft.challenger_partner_id} onChange={(e) => update('challenger_partner_id', e.target.value)}>
                <option value="">+ Đồng đội</option>
                {people.filter((p) => p.id !== draft.challenger_id && p.id !== draft.opponent_id && p.id !== draft.opponent_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
            )}
          </div>
          <div className="ck-vs-badge">VS</div>
          <div className="ck-team">
            <div className="ck-team-label ck-label-red">🎯 Đối thủ</div>
            <select className="ck-select" value={draft.opponent_id} onChange={(e) => update('opponent_id', e.target.value)}>
              <option value="">Chọn người</option>
              {people.filter((p) => p.id !== draft.challenger_id && p.id !== draft.challenger_partner_id)
                .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
            </select>
            {isDoubles && (
              <select className="ck-select" value={draft.opponent_partner_id} onChange={(e) => update('opponent_partner_id', e.target.value)}>
                <option value="">+ Đồng đội</option>
                {people.filter((p) => p.id !== draft.opponent_id && p.id !== draft.challenger_id && p.id !== draft.challenger_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Trạng thái & ngày */}
        <div className="ck-row-2" style={{ marginBottom: 12 }}>
          <label className="ck-field">
            <span className="ck-field-label">📋 Trạng thái</span>
            <select className="ck-select" value={draft.status} onChange={(e) => update('status', e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="ck-field">
            <span className="ck-field-label">📅 Ngày đấu</span>
            <input className="ck-input" type="date" value={draft.played_at} onChange={(e) => update('played_at', e.target.value)} />
          </label>
        </div>

        {/* Kết quả */}
        <label className="ck-field" style={{ marginBottom: 12 }}>
          <span className="ck-field-label">🏆 Bên thắng</span>
          <select className="ck-select" value={draft.winner_side} onChange={(e) => update('winner_side', e.target.value)}>
            <option value="">— Chưa xác định</option>
            <option value="challenger">Thách đấu thắng{draft.challenger_id ? ` (${people.find((p) => p.id === draft.challenger_id)?.full_name || ''})` : ''}</option>
            <option value="opponent">Đối thủ thắng{draft.opponent_id ? ` (${people.find((p) => p.id === draft.opponent_id)?.full_name || ''})` : ''}</option>
          </select>
        </label>

        {/* Điểm set */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: '0.8rem', color: '#8a94a0', marginBottom: 8 }}>📊 Điểm từng set</p>
          <div className="rs-scores-header">
            <span>Set</span><span>{challName}</span><span></span><span>{oppName}</span>
          </div>
          {scores.map((s, i) => (
            <div key={i} className="rs-score-row">
              <span className="rs-set-num">Set {i + 1}</span>
              <input className="rs-score-input" type="number" min="0" max="99"
                value={s.challenger} onChange={(e) => updateScore(i, 'challenger', e.target.value)} placeholder="0" />
              <span className="rs-dash">–</span>
              <input className="rs-score-input" type="number" min="0" max="99"
                value={s.opponent} onChange={(e) => updateScore(i, 'opponent', e.target.value)} placeholder="0" />
              {scores.length > 1 && (
                <button type="button" className="rs-remove-set" onClick={() => removeSet(i)}>×</button>
              )}
            </div>
          ))}
          <button type="button" className="rs-add-set" onClick={addSet}>+ Thêm set</button>
        </div>

        {/* Chi tiết */}
        <label className="ck-field" style={{ marginBottom: 8 }}>
          <span className="ck-field-label">🎁 Vật phẩm cược</span>
          <input className="ck-input" type="text" value={draft.bet_items} onChange={(e) => update('bet_items', e.target.value)} />
        </label>
        <label className="ck-field" style={{ marginBottom: 16 }}>
          <span className="ck-field-label">📝 Ghi chú</span>
          <input className="ck-input" type="text" value={draft.note} onChange={(e) => update('note', e.target.value)} />
        </label>

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" className="ck-btn-submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}
