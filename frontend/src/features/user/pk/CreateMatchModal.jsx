/* Modal tạo kèo thách đấu thủ công (đơn/đôi) cho user */
export function CreateMatchModal({ form, updateForm, onSubmit, onClose, activePerson, otherPeople }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal ck-modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>⚔️ Tạo kèo thách đấu</h2>
          <button className="icon-button" onClick={onClose}>×</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="ck-type-toggle">
            <button type="button"
              className={`ck-type-btn${form.match_type === 'singles' ? ' ck-type-active' : ''}`}
              onClick={() => updateForm('match_type', 'singles')}>
              <span className="ck-type-icon">⚔️</span>
              <strong>Đánh đơn</strong>
              <small>1 vs 1</small>
            </button>
            <button type="button"
              className={`ck-type-btn${form.match_type === 'doubles' ? ' ck-type-active' : ''}`}
              onClick={() => updateForm('match_type', 'doubles')}>
              <span className="ck-type-icon">🤝</span>
              <strong>Đánh đôi</strong>
              <small>2 vs 2</small>
            </button>
          </div>

          <div className="ck-sets-row">
            <span className="ck-sets-label">🏸 Số set</span>
            <div className="ck-sets-options">
              {[1, 3, 5].map((s) => (
                <button key={s} type="button"
                  className={`ck-set-btn${form.sets === s ? ' ck-set-active' : ''}`}
                  onClick={() => updateForm('sets', s)}>
                  {s} set
                </button>
              ))}
            </div>
          </div>

          <div className="ck-vs-row">
            <div className="ck-team">
              <div className="ck-team-label ck-label-blue">🧑 Bên tôi</div>
              <div className="ck-team-me">
                <span className="ck-me-name">{activePerson?.full_name || 'Tôi'}</span>
              </div>
              {form.match_type === 'doubles' && (
                <select className="ck-select" value={form.challenger_partner_id}
                  onChange={(e) => updateForm('challenger_partner_id', e.target.value)} required>
                  <option value="">+ Chọn đồng đội</option>
                  {otherPeople.filter((p) => p.id !== form.opponent_id && p.id !== form.opponent_partner_id)
                    .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                </select>
              )}
            </div>

            <div className="ck-vs-badge">VS</div>

            <div className="ck-team">
              <div className="ck-team-label ck-label-red">🎯 Đối thủ</div>
              <select className="ck-select" value={form.opponent_id}
                onChange={(e) => updateForm('opponent_id', e.target.value)} required>
                <option value="">Chọn đối thủ</option>
                {otherPeople.filter((p) => p.id !== form.challenger_partner_id)
                  .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
              </select>
              {form.match_type === 'doubles' && (
                <select className="ck-select" value={form.opponent_partner_id}
                  onChange={(e) => updateForm('opponent_partner_id', e.target.value)} required>
                  <option value="">+ Đồng đội đối thủ</option>
                  {otherPeople.filter((p) => p.id !== form.opponent_id && p.id !== form.challenger_partner_id)
                    .map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="ck-details">
            <label className="ck-field">
              <span className="ck-field-label">🎁 Vật phẩm cược</span>
              <input className="ck-input" type="text" value={form.bet_items}
                onChange={(e) => updateForm('bet_items', e.target.value)}
                placeholder="VD: 2 chai nước, 1 ổ bánh mì" />
            </label>
            <div className="ck-row-2">
              <label className="ck-field">
                <span className="ck-field-label">📅 Ngày đấu *</span>
                <input className="ck-input" type="date" value={form.played_at}
                  onChange={(e) => updateForm('played_at', e.target.value)} required />
              </label>
              <label className="ck-field">
                <span className="ck-field-label">📝 Ghi chú</span>
                <input className="ck-input" type="text" value={form.note}
                  onChange={(e) => updateForm('note', e.target.value)} placeholder="Tuỳ chọn" />
              </label>
            </div>
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
