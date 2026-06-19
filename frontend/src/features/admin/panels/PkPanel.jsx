import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Modal, Panel } from '../../../components/common'
import { formatDate, initials } from '../../../utils/appUtils'
import { RandomMatchmaker } from '../../user/RandomMatchmaker'

const STATUS_LABEL = { pending: 'Chờ', active: 'Đang đấu', completed: 'Xong', cancelled: 'Đã hủy' }

/* ── Leaderboard helpers (shared logic with PkArena) ── */
function getTierCls(rank, total) {
  if (rank === 1) return 'lb-tier-gold'
  if (rank === 2) return 'lb-tier-silver'
  if (rank === 3) return 'lb-tier-bronze'
  if (total >= 5 && rank >= total - 1) return 'lb-tier-bottom'
  return ''
}
function RankBadge({ rank, total }) {
  if (rank === 1) return <span className="lb-rank-badge lb-gold">🥇</span>
  if (rank === 2) return <span className="lb-rank-badge lb-silver">🥈</span>
  if (rank === 3) return <span className="lb-rank-badge lb-bronze">🥉</span>
  if (total >= 5 && rank === total) return <span className="lb-rank-badge lb-last">💀</span>
  if (total >= 5 && rank === total - 1) return <span className="lb-rank-badge lb-near-last">😅</span>
  return <span className="lb-rank-num">{rank}</span>
}
function WilsonBar({ score }) {
  const pct = Math.min(100, Math.max(0, score || 0))
  let cls = 'lb-bar-low'
  if (pct >= 60) cls = 'lb-bar-high'
  else if (pct >= 40) cls = 'lb-bar-mid'
  return (
    <div className="lb-bar-wrap" title={`${score}%`}>
      <div className={`lb-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      <span className="lb-bar-label">{score}%</span>
    </div>
  )
}
function AdminLeaderboardRow({ row, total }) {
  return (
    <tr className={getTierCls(row.rank, total)}>
      <td><RankBadge rank={row.rank} total={total} /></td>
      <td><PersonCell p={row} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td className="lb-points"><span className="lb-points-chip">{row.points ?? '—'}</span></td>
      <td><WilsonBar score={row.wilson_score} /></td>
    </tr>
  )
}
function AdminLeaderboardLegend({ total }) {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item"><span className="lb-dot lb-dot-gold" />Top 3</span>
      <span className="lb-legend-item"><span className="lb-dot lb-dot-mid" />Trung bình</span>
      {total >= 5 && <span className="lb-legend-item"><span className="lb-dot lb-dot-bottom" />Cần cố gắng</span>}
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">★ Wilson Score — đánh nhiều trận mới cao</span>
    </div>
  )
}
function wilsonScore(wins, total) {
  if (total === 0) return 0
  const p = wins / total, z = 1.96, z2 = z * z
  const num = p + z2 / (2 * total) - z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total))
  return Math.max(0, Math.round((num / (1 + z2 / total)) * 1000) / 10)
}
function computeLeaderboard(matches, matchType, people) {
  const completed = matches.filter((m) => m.status === 'completed' && m.match_type === matchType)
  const stats = {}
  completed.forEach((m) => {
    const ch = [m.challenger_id, m.challenger_partner_id].filter(Boolean)
    const op = [m.opponent_id,   m.opponent_partner_id  ].filter(Boolean)
    ;[...ch, ...op].forEach((pid) => { if (!stats[pid]) stats[pid] = { wins: 0, losses: 0 } })
    ch.forEach((pid) => { if (m.winner_side === 'challenger') stats[pid].wins++; else stats[pid].losses++ })
    op.forEach((pid) => { if (m.winner_side === 'opponent')   stats[pid].wins++; else stats[pid].losses++ })
  })
  const rows = Object.entries(stats).map(([id, s]) => {
    const total = s.wins + s.losses
    const p = people.find((x) => x.id === id) || {}
    return { id, full_name: p.full_name || '?', nickname: p.nickname || null, avatar_url: p.avatar_url || null,
      wins: s.wins, losses: s.losses, total_matches: total,
      win_rate: total > 0 ? Math.round(s.wins / total * 1000) / 10 : 0,
      wilson_score: wilsonScore(s.wins, total), points: Math.max(0, s.wins * 3 - s.losses) }
  })
  rows.sort((a, b) => b.wilson_score - a.wilson_score || b.points - a.points || b.wins - a.wins)
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

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

function AdminMatchCard({ m, onEdit, onDelete }) {
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
        <TeamBlock
          main={m.challenger}
          partner={m.challenger_partner}
          label="Thách đấu"
          isWinner={m.status === 'completed' && challengerWon}
        />
        <div className="pk-vs-center">
          <span className="pk-vs-text">VS</span>
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
            <button onClick={() => onEdit(m)}>Sửa</button>
            <button className="danger" onClick={() => onDelete(m)}>Xóa</button>
          </ActionGroup>
        </div>
      </div>
    </div>
  )
}

export function PkPanel() {
  const [matches, setMatches]     = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [people, setPeople]       = useState([])
  const [filter, setFilter]       = useState('all')
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState('')
  const [editing, setEditing]     = useState(null)
  const [deleting, setDeleting]   = useState(null)
  const [showRandom, setShowRandom]     = useState(false)
  const [lbType, setLbType]             = useState('singles')
  const [showCreate, setShowCreate]     = useState(false)
  const [matchSearch, setMatchSearch]   = useState('')
  const [dateFilter, setDateFilter]     = useState('all')
  const [specificDate, setSpecificDate] = useState('')

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll() {
    setLoading(true)
    try {
      const [ms, lb, pp] = await Promise.all([
        api.pk.matches().catch(() => []),
        api.pk.leaderboard().catch(() => []),
        api.pk.people().catch(() => []),
      ])
      setMatches(ms)
      setLeaderboard(lb)
      setPeople(pp)
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

  async function handleCreate(payload) {
    try {
      await api.pk.create(payload)
      setToast('Đã tạo kèo.')
      setShowCreate(false)
      void loadAll()
    } catch (err) { setToast(err.message) }
  }

  function matchInDateRange(m) {
    const d = new Date(m.played_at || m.created_at)
    const now = new Date()
    if (specificDate) return d.toDateString() === new Date(specificDate).toDateString()
    if (dateFilter === 'today') return d.toDateString() === now.toDateString()
    if (dateFilter === 'week') { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); return d >= s }
    if (dateFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return true
  }

  function matchNameSearch(m) {
    if (!matchSearch.trim()) return true
    const q = matchSearch.toLowerCase()
    const names = [
      m.challenger?.full_name, m.challenger?.nickname,
      m.opponent?.full_name, m.opponent?.nickname,
      m.challenger_partner?.full_name, m.opponent_partner?.full_name,
    ].filter(Boolean).map((s) => s.toLowerCase())
    return names.some((n) => n.includes(q))
  }

  const lbSingles = useMemo(() => computeLeaderboard(matches, 'singles', people), [matches, people])
  const lbDoubles = useMemo(() => computeLeaderboard(matches, 'doubles', people), [matches, people])
  const activeLb  = lbType === 'singles' ? lbSingles : lbDoubles

  const filtered = useMemo(() => sortByDate(
    (filter === 'all' ? matches : matches.filter((m) => m.status === filter))
      .filter((m) => matchInDateRange(m) && matchNameSearch(m))
  ), [matches, filter, matchSearch, dateFilter])

  return (
    <>
      {toast && <div className="toast" role="alert">{toast}</div>}

      <section className="grid one">
        {/* Leaderboard */}
        <Panel title="Bảng xếp hạng PK">
          <div className="lb-type-toggle">
            <button className={lbType === 'singles' ? 'active' : ''} onClick={() => setLbType('singles')}>
              ⚔️ Đơn <span className="pk-count">{lbSingles.length}</span>
            </button>
            <button className={lbType === 'doubles' ? 'active' : ''} onClick={() => setLbType('doubles')}>
              🤝 Đôi <span className="pk-count">{lbDoubles.length}</span>
            </button>
          </div>
          {loading ? <p className="muted">Đang tải...</p> : activeLb.length === 0 ? (
            <p className="muted">Chưa có dữ liệu {lbType === 'singles' ? 'đấu đơn' : 'đấu đôi'}.</p>
          ) : (
            <>
              <AdminLeaderboardLegend total={activeLb.length} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Người chơi</th>
                      <th>Thắng</th><th>Thua</th><th>Tổng</th>
                      <th title="Điểm tích lũy: +3 thắng, -1 thua">Điểm</th>
                      <th title="Wilson Score: xếp hạng thống kê cân bằng">Chỉ số ★</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLb.map((row) => (
                      <AdminLeaderboardRow key={row.id} row={row} total={activeLb.length} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        {/* All matches */}
        <Panel title="Tất cả kèo đấu" action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pk-create-btn" onClick={() => setShowRandom(true)}>🎲 Ghép ngẫu nhiên</button>
            <button className="pk-create-btn" onClick={() => setShowCreate(true)}>+ Tạo kèo</button>
          </div>
        }>
          <div className="pk-filter-tabs" style={{ marginBottom: 12 }}>
            {['all', 'pending', 'active', 'completed', 'cancelled'].map((s) => (
              <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
                {s === 'all' ? 'Tất cả' : STATUS_LABEL[s]}
                {s !== 'all' && <span className="pk-count">{matches.filter((m) => m.status === s).length}</span>}
              </button>
            ))}
          </div>

          <div className="pk-match-filters">
            <div className="pk-search-wrap">
              <span className="pk-search-icon">🔍</span>
              <input
                className="pk-search-input"
                placeholder="Tìm theo tên người chơi..."
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
              />
              {matchSearch && <button className="pk-search-clear" onClick={() => setMatchSearch('')}>×</button>}
            </div>
            <div className="pk-filter-row">
              {['all','today','week','month'].map((d) => (
                <button key={d} className={`pk-chip${!specificDate && dateFilter === d ? ' pk-chip-active' : ''}`}
                  onClick={() => { setDateFilter(d); setSpecificDate('') }}>
                  {d === 'all' ? 'Tất cả ngày' : d === 'today' ? 'Hôm nay' : d === 'week' ? 'Tuần này' : 'Tháng này'}
                </button>
              ))}
              <div className="pk-date-wrap">
                <input
                  type="date"
                  className={`pk-date-input${specificDate ? ' pk-date-active' : ''}`}
                  value={specificDate}
                  onChange={(e) => { setSpecificDate(e.target.value); setDateFilter('all') }}
                />
                {specificDate && <button className="pk-search-clear pk-date-clear" onClick={() => setSpecificDate('')}>×</button>}
              </div>
            </div>
          </div>

          {loading ? <p className="muted">Đang tải...</p> : filtered.length === 0 ? (
            <p className="muted">Không có kèo nào.</p>
          ) : (
            <div className="pk-match-list">
              {filtered.map((m) => (
                <AdminMatchCard
                  key={m.id}
                  m={m}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      {showCreate && (
        <AdminCreateMatchModal
          people={people}
          prefill={showCreate?.prefill}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {showRandom && (
        <RandomMatchmaker
          people={people}
          leaderboard={leaderboard}
          onClose={() => setShowRandom(false)}
          onCreate={(prefill) => {
            setShowRandom(false)
            setShowCreate({ prefill })
          }}
        />
      )}

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

function AdminCreateMatchModal({ people, onClose, onSubmit, prefill }) {
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

function PkEditModal({ match, onClose, onSubmit }) {
  const sets = match.sets || 1
  const [draft, setDraft] = useState({
    status:      match.status      || 'pending',
    winner_side: match.winner_side || '',
    bet_items:   match.bet_items   || '',
    played_at:   match.played_at   ? match.played_at.slice(0, 10) : '',
    note:        match.note        || '',
  })
  const [scores, setScores] = useState(
    match.set_scores?.length
      ? match.set_scores.map((s) => ({ challenger: s.challenger ?? '', opponent: s.opponent ?? '' }))
      : Array.from({ length: sets }, () => ({ challenger: '', opponent: '' }))
  )

  function update(k, v) { setDraft((d) => ({ ...d, [k]: v })) }
  function updateScore(i, side, val) {
    setScores((prev) => prev.map((s, idx) => idx === i ? { ...s, [side]: val } : s))
  }
  function addSet() { setScores((prev) => [...prev, { challenger: '', opponent: '' }]) }
  function removeSet(i) { setScores((prev) => prev.filter((_, idx) => idx !== i)) }

  function handleSubmit(e) {
    e.preventDefault()
    const parsed = scores.map((s) => ({
      challenger: Number(s.challenger) || 0,
      opponent: Number(s.opponent) || 0,
    })).filter((s) => s.challenger > 0 || s.opponent > 0)
    onSubmit({
      status:      draft.status,
      winner_side: draft.winner_side || null,
      bet_items:   draft.bet_items   || null,
      played_at:   draft.played_at   || null,
      note:        draft.note        || null,
      set_scores:  parsed.length ? parsed : null,
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
        <div>
          <p style={{ fontSize: '0.8rem', color: '#8a94a0', marginBottom: 8 }}>📊 Điểm từng set</p>
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
                value={s.challenger} onChange={(e) => updateScore(i, 'challenger', e.target.value)} placeholder="0" />
              <span className="rs-dash">–</span>
              <input className="rs-score-input" type="number" min="0" max="99"
                value={s.opponent} onChange={(e) => updateScore(i, 'opponent', e.target.value)} placeholder="0" />
              {scores.length > 1 && (
                <button type="button" className="rs-remove-set" onClick={() => removeSet(i)} title="Xóa set này">×</button>
              )}
            </div>
          ))}
          <button type="button" className="rs-add-set" onClick={addSet}>+ Thêm set</button>
        </div>
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
