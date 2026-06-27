import { useState } from 'react'

/* Modal admin tạo kèo — chọn cả 2 bên, có thể ghi luôn kết quả */
export function AdminCreateMatchModal({ people, onClose, onSubmit, prefill }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    match_type: prefill?.match_type || 'singles',
    challenger_id: prefill?.challenger_id || '',
    opponent_id: prefill?.opponent_id || '',
    challenger_partner_id: prefill?.challenger_partner_id || '',
    opponent_partner_id: prefill?.opponent_partner_id || '',
    sets: 1,
    bet_items: '',
    played_at: today,
    note: '',
    status: 'completed',
    winner_side: '',
  })

  function upd(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.challenger_id) return
    if (!form.opponent_id) return
    if (form.challenger_id === form.opponent_id) return
    const payload = {
      match_type: form.match_type,
      challenger_id: form.challenger_id,
      opponent_id: form.opponent_id,
      challenger_partner_id: form.match_type === 'doubles' ? form.challenger_partner_id || null : null,
      opponent_partner_id:   form.match_type === 'doubles' ? form.opponent_partner_id   || null : null,
      sets:        Number(form.sets) || 1,
      bet_items:   form.bet_items   || null,
      played_at:   form.played_at   || null,
      note:        form.note        || null,
      status:      form.status,
      winner_side: form.status === 'completed' ? (form.winner_side || null) : null,
    }
    onSubmit(payload)
  }

  const allPeople = people
  const isDoubles = form.match_type === 'doubles'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal ck-modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>⚔️ Tạo kèo (Admin)</h2>
          <button className="icon-button" onClick={onClose}>×</button>
        </header>
        <form onSubmit={handleSubmit}>

          {/* Type toggle */}
          <div className="ck-type-toggle">
            <button type="button" className={`ck-type-btn${!isDoubles ? ' ck-type-active' : ''}`}
              onClick={() => upd('match_type', 'singles')}>
              <span className="ck-type-icon">⚔️</span>
              <strong>Đánh đơn</strong><small>1 vs 1</small>
            </button>
            <button type="button" className={`ck-type-btn${isDoubles ? ' ck-type-active' : ''}`}
              onClick={() => upd('match_type', 'doubles')}>
              <span className="ck-type-icon">🤝</span>
              <strong>Đánh đôi</strong><small>2 vs 2</small>
            </button>
          </div>

          {/* Số set */}
          <div className="ck-sets-row">
            <span className="ck-sets-label">🏸 Số set</span>
            <div className="ck-sets-options">
              {[1, 3, 5].map((s) => (
                <button key={s} type="button"
                  className={`ck-set-btn${form.sets === s ? ' ck-set-active' : ''}`}
                  onClick={() => upd('sets', s)}>
                  {s} set
                </button>
              ))}
            </div>
          </div>

          {/* VS row — admin chọn cả 2 bên */}
          <div className="ck-vs-row">
            <div className="ck-team">
              <div className="ck-team-label ck-label-blue">🧑 Bên thách đấu</div>
              <select className="ck-select" value={form.challenger_id}
                onChange={(e) => upd('challenger_id', e.target.value)} required>
                <option value="">Chọn người thách đấu</option>
                {allPeople.filter((p) => p.id !== form.opponent_id && p.id !== form.opponent_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
              {isDoubles && (
                <select className="ck-select" value={form.challenger_partner_id}
                  onChange={(e) => upd('challenger_partner_id', e.target.value)}>
                  <option value="">+ Đồng đội</option>
                  {allPeople.filter((p) => p.id !== form.challenger_id && p.id !== form.opponent_id && p.id !== form.opponent_partner_id)
                    .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                </select>
              )}
            </div>

            <div className="ck-vs-badge">VS</div>

            <div className="ck-team">
              <div className="ck-team-label ck-label-red">🎯 Bên đối thủ</div>
              <select className="ck-select" value={form.opponent_id}
                onChange={(e) => upd('opponent_id', e.target.value)} required>
                <option value="">Chọn đối thủ</option>
                {allPeople.filter((p) => p.id !== form.challenger_id && p.id !== form.challenger_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
              {isDoubles && (
                <select className="ck-select" value={form.opponent_partner_id}
                  onChange={(e) => upd('opponent_partner_id', e.target.value)}>
                  <option value="">+ Đồng đội</option>
                  {allPeople.filter((p) => p.id !== form.opponent_id && p.id !== form.challenger_id && p.id !== form.challenger_partner_id)
                    .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Chi tiết */}
          <div className="ck-details">
            <div className="ck-row-2">
              <label className="ck-field">
                <span className="ck-field-label">📅 Ngày đấu</span>
                <input className="ck-input" type="date" value={form.played_at}
                  onChange={(e) => upd('played_at', e.target.value)} />
              </label>
              <label className="ck-field">
                <span className="ck-field-label">📋 Trạng thái</span>
                <select className="ck-select" value={form.status} onChange={(e) => upd('status', e.target.value)}>
                  <option value="completed">Đã hoàn thành</option>
                  <option value="pending">Chờ đấu</option>
                  <option value="active">Đang diễn ra</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </label>
            </div>

            {form.status === 'completed' && (
              <label className="ck-field">
                <span className="ck-field-label">🏆 Kết quả — Bên thắng</span>
                <select className="ck-select" value={form.winner_side} onChange={(e) => upd('winner_side', e.target.value)}>
                  <option value="">Chưa xác định</option>
                  <option value="challenger">
                    Bên thách đấu thắng{form.challenger_id ? ` (${allPeople.find((p) => p.id === form.challenger_id)?.full_name || ''})` : ''}
                  </option>
                  <option value="opponent">
                    Bên đối thủ thắng{form.opponent_id ? ` (${allPeople.find((p) => p.id === form.opponent_id)?.full_name || ''})` : ''}
                  </option>
                </select>
              </label>
            )}

            <label className="ck-field">
              <span className="ck-field-label">🎁 Vật phẩm cược</span>
              <input className="ck-input" type="text" value={form.bet_items}
                onChange={(e) => upd('bet_items', e.target.value)}
                placeholder="VD: 2 chai nước, 1 ổ bánh mì" />
            </label>
            <label className="ck-field">
              <span className="ck-field-label">📝 Ghi chú</span>
              <input className="ck-input" type="text" value={form.note}
                onChange={(e) => upd('note', e.target.value)} placeholder="Tuỳ chọn" />
            </label>
          </div>

          <footer className="ck-footer">
            <button type="button" className="ck-btn-cancel" onClick={onClose}>Hủy</button>
            <button type="submit" className="ck-btn-submit">⚔️ Tạo kèo</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
