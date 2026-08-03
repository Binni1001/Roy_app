import { useState } from 'react'
import { Modal } from '../../../../components/common'
import { STATUS_LABEL } from './pkConstants'

/* Admin có thể sửa người của trận đã chốt; backend sẽ dựng lại Elo toàn kỳ. */
export function PkEditModal({ match, people = [], onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    match_type:             match.match_type             || 'singles',
    sets:                   match.sets                   || 1,
    challenger_id:          match.challenger_id          || '',
    opponent_id:            match.opponent_id            || '',
    challenger_partner_id:  match.challenger_partner_id  || '',
    opponent_partner_id:    match.opponent_partner_id    || '',
    status:                 match.status                 || 'pending',
    bet_items:              match.bet_items              || '',
    played_at:              match.played_at ? match.played_at.slice(0, 10) : '',
    note:                   match.note                   || '',
  })
  function update(k, v) { setDraft((d) => ({ ...d, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    const isDoublesVal = draft.match_type === 'doubles'
    onSubmit({
      match_type:             draft.match_type,
      sets:                   Number(draft.sets) || 1,
      challenger_id:          draft.challenger_id         || null,
      opponent_id:            draft.opponent_id           || null,
      challenger_partner_id:  isDoublesVal ? (draft.challenger_partner_id || null) : null,
      opponent_partner_id:    isDoublesVal ? (draft.opponent_partner_id   || null) : null,
      status:                 draft.status,
      bet_items:              draft.bet_items             || null,
      played_at:              draft.played_at             || null,
      note:                   draft.note                  || null,
    })
  }

  const isDoubles = draft.match_type === 'doubles'
  const isCompleted = match.status === 'completed'

  return (
    <Modal title="✏️ Sửa trận đấu (Quản trị)" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>

        {isCompleted && (
          <p className="pk-edit-warning">
            Trận đã hoàn tất. Khi lưu, kết quả và tỷ số được giữ nguyên; điểm Elo của toàn kỳ sẽ được tính lại.
          </p>
        )}

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
            <select className="ck-select" value={draft.challenger_id} onChange={(e) => update('challenger_id', e.target.value)} required>
              <option value="">Chọn người</option>
              {people.filter((p) => p.id !== draft.opponent_id && p.id !== draft.opponent_partner_id)
                .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
            </select>
            {isDoubles && (
              <select className="ck-select" value={draft.challenger_partner_id} onChange={(e) => update('challenger_partner_id', e.target.value)} required>
                <option value="">+ Đồng đội</option>
                {people.filter((p) => p.id !== draft.challenger_id && p.id !== draft.opponent_id && p.id !== draft.opponent_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
            )}
          </div>
          <div className="ck-vs-badge">ĐẤU</div>
          <div className="ck-team">
            <div className="ck-team-label ck-label-red">🎯 Đối thủ</div>
            <select className="ck-select" value={draft.opponent_id} onChange={(e) => update('opponent_id', e.target.value)} required>
              <option value="">Chọn người</option>
              {people.filter((p) => p.id !== draft.challenger_id && p.id !== draft.challenger_partner_id)
                .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
            </select>
            {isDoubles && (
              <select className="ck-select" value={draft.opponent_partner_id} onChange={(e) => update('opponent_partner_id', e.target.value)} required>
                <option value="">+ Đồng đội</option>
                {people.filter((p) => p.id !== draft.opponent_id && p.id !== draft.challenger_id && p.id !== draft.challenger_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Trạng thái & ngày */}
        <div className="ck-row-2" style={{ marginBottom: 12 }}>
          {isCompleted ? (
            <label className="ck-field">
              <span className="ck-field-label">📋 Trạng thái</span>
              <span className="pk-edit-locked-status">Đã hoàn tất và khóa kết quả</span>
            </label>
          ) : (
            <label className="ck-field">
              <span className="ck-field-label">📋 Trạng thái</span>
              <select className="ck-select" value={draft.status} onChange={(e) => update('status', e.target.value)}>
                {['pending', 'active', 'cancelled'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          )}
          <label className="ck-field">
            <span className="ck-field-label">📅 Ngày đấu</span>
            <input className="ck-input" type="date" value={draft.played_at} onChange={(e) => update('played_at', e.target.value)} required />
          </label>
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
          <button type="submit" className="ck-btn-submit">
            {isCompleted ? 'Lưu và tính lại Elo' : 'Lưu thay đổi'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
