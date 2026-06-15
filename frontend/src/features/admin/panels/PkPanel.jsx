import { useEffect, useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Modal, Panel } from '../../../components/common'
import { formatDate, initials } from '../../../utils/appUtils'

const STATUS_LABEL = { pending: 'Chờ', active: 'Đang đấu', completed: 'Xong', cancelled: 'Đã hủy' }
const STATUS_OPTIONS = ['pending', 'active', 'completed', 'cancelled']
const WINNER_OPTIONS = [{ value: '', label: '—' }, { value: 'challenger', label: 'Bên thách đấu' }, { value: 'opponent', label: 'Bên đối thủ' }]

function sortByDate(arr) {
  return [...arr].sort((a, b) => new Date(b.played_at || b.created_at) - new Date(a.played_at || a.created_at))
}

function PersonCell({ p }) {
  if (!p) return <span className="muted">—</span>
  return (
    <div className="pk-person-cell">
      {p.avatar_url
        ? <img src={p.avatar_url} className="avatar avatar-img pk-avatar" alt={p.full_name} />
        : <span className="avatar pk-avatar">{initials(p.full_name)}</span>}
      <span>{p.full_name}</span>
    </div>
  )
}

export function PkPanel() {
  const [matches, setMatches]     = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [filter, setFilter]       = useState('all')
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState('')
  const [editing, setEditing]     = useState(null)
  const [deleting, setDeleting]   = useState(null)

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll() {
    setLoading(true)
    try {
      const [ms, lb] = await Promise.all([
        api.pk.matches().catch(() => []),
        api.pk.leaderboard().catch(() => []),
      ])
      setMatches(ms)
      setLeaderboard(lb)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(id, payload) {
    try {
      await api.pk.update(id, payload)
      setToast('Đã cập nhật kèo.')
      setEditing(null)
      void loadAll()
    } catch (err) { setToast(err.message) }
  }

  async function handleDelete(id) {
    try {
      await api.pk.remove(id)
      setToast('Đã xóa kèo.')
      setDeleting(null)
      void loadAll()
    } catch (err) { setToast(err.message) }
  }

  const filtered = sortByDate(
    filter === 'all' ? matches : matches.filter((m) => m.status === filter)
  )

  return (
    <>
      {toast && <div className="toast" role="alert">{toast}</div>}

      <section className="grid one">
        {/* Leaderboard */}
        <Panel title="Bảng xếp hạng PK">
          {loading ? <p className="muted">Đang tải...</p> : leaderboard.length === 0 ? (
            <p className="muted">Chưa có dữ liệu.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Người chơi</th><th>Thắng</th><th>Thua</th><th>Tổng</th><th>Tỉ lệ</th></tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.id}>
                      <td><strong className={row.rank <= 3 ? 'pk-rank-top' : ''}>{row.rank}</strong></td>
                      <td><PersonCell p={row} /></td>
                      <td className="pk-win">{row.wins}</td>
                      <td className="pk-loss">{row.losses}</td>
                      <td>{row.total_matches}</td>
                      <td>{row.win_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* All matches */}
        <Panel title="Tất cả kèo đấu">
          {/* Status filter */}
          <div className="pk-filter-tabs" style={{ marginBottom: 16 }}>
            {['all', 'pending', 'active', 'completed', 'cancelled'].map((s) => (
              <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
                {s === 'all' ? 'Tất cả' : STATUS_LABEL[s]}
                {s !== 'all' && <span className="pk-count">{matches.filter((m) => m.status === s).length}</span>}
              </button>
            ))}
          </div>

          {loading ? <p className="muted">Đang tải...</p> : filtered.length === 0 ? (
            <p className="muted">Không có kèo nào.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th>Bên thách đấu</th>
                    <th>Bên đối thủ</th>
                    <th>Thắng</th>
                    <th>Cược</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td>{m.played_at ? formatDate(m.played_at) : <span className="muted">—</span>}</td>
                      <td>{m.match_type === 'singles' ? 'Đơn' : 'Đôi'}</td>
                      <td><span className={`pk-badge pk-badge-${m.status}`}>{STATUS_LABEL[m.status]}</span></td>
                      <td>
                        <PersonCell p={m.challenger} />
                        {m.challenger_partner && <div><small className="muted">& </small><PersonCell p={m.challenger_partner} /></div>}
                      </td>
                      <td>
                        <PersonCell p={m.opponent} />
                        {m.opponent_partner && <div><small className="muted">& </small><PersonCell p={m.opponent_partner} /></div>}
                      </td>
                      <td>
                        {m.winner_side === 'challenger' ? <span className="pk-win">Thách đấu</span>
                          : m.winner_side === 'opponent' ? <span className="pk-win">Đối thủ</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td>{m.bet_items || <span className="muted">—</span>}</td>
                      <td>
                        <ActionGroup>
                          <button onClick={() => setEditing(m)}>Sửa</button>
                          <button className="danger" onClick={() => setDeleting(m)}>Xóa</button>
                        </ActionGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>

      {editing && (
        <PkEditModal
          match={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => handleUpdate(editing.id, payload)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Xóa kèo"
          message={`Xóa kèo giữa ${deleting.challenger?.full_name} vs ${deleting.opponent?.full_name}?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => handleDelete(deleting.id)}
        />
      )}
    </>
  )
}

function PkEditModal({ match, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    status:      match.status      || 'pending',
    winner_side: match.winner_side || '',
    bet_items:   match.bet_items   || '',
    played_at:   match.played_at   ? match.played_at.slice(0, 10) : '',
    note:        match.note        || '',
  })

  function update(k, v) { setDraft((d) => ({ ...d, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      status:      draft.status,
      winner_side: draft.winner_side || null,
      bet_items:   draft.bet_items   || null,
      played_at:   draft.played_at   || null,
      note:        draft.note        || null,
    })
  }

  return (
    <Modal title="Sửa kèo đấu" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label>Trạng thái
          <select value={draft.status} onChange={(e) => update('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label>Người thắng
          <select value={draft.winner_side} onChange={(e) => update('winner_side', e.target.value)}>
            {WINNER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>Vật phẩm cược
          <input type="text" value={draft.bet_items} onChange={(e) => update('bet_items', e.target.value)} />
        </label>
        <label>Ngày đấu
          <input type="date" value={draft.played_at} onChange={(e) => update('played_at', e.target.value)} />
        </label>
        <label>Ghi chú
          <input type="text" value={draft.note} onChange={(e) => update('note', e.target.value)} />
        </label>
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}
