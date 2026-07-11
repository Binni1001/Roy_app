import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../api/client'
import { ConfirmModal, Panel, SkeletonMatchCards, SkeletonTable } from '../../../components/common'
import { computeLeaderboard } from '../../../utils/leaderboardUtils'
import { RandomMatchmaker } from '../../user/RandomMatchmaker'
import { STATUS_LABEL } from './pk/pkConstants'
import { AdminLeaderboardRow, AdminLeaderboardLegend } from './pk/AdminLeaderboard'
import { AdminMatchCard } from './pk/AdminMatchCard'
import { AdminCreateMatchModal } from './pk/AdminCreateMatchModal'
import { PkEditModal } from './pk/PkEditModal'

function sortByDate(arr) {
  return [...arr].sort((a, b) => new Date(b.played_at || b.created_at) - new Date(a.played_at || a.created_at))
}

export function PkPanel({ periodId }) {
  const [matches, setMatches]     = useState([])
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll() }, [periodId])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll() {
    if (!periodId) { setMatches([]); return }
    setLoading(true)
    try {
      const [ms, pp] = await Promise.all([
        api.pk.matches(periodId).catch(() => []),
        api.pk.people().catch(() => []),
      ])
      setMatches(ms)
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
      await api.pk.create({ ...payload, period_id: periodId })
      setToast('Đã tạo kèo.')
      setShowCreate(false)
      void loadAll()
    } catch (err) { setToast(err.message) }
  }

  async function handleCreateBatch(payload) {
    try {
      const created = await api.pk.createBulk(payload, periodId)
      setToast(`Đã tạo ${created.length} kèo.`)
      void loadAll()
    } catch (err) { setToast(err.message); throw err }
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
          {loading ? <SkeletonTable rows={5} cols={7} /> : activeLb.length === 0 ? (
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
                      <th title="Điểm trung bình mỗi trận — chỉ số xếp hạng chính">Điểm TB/trận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLb.map((row) => (
                      <AdminLeaderboardRow key={row.id} row={row} total={activeLb.filter((r) => r.qualified).length} />
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

          {loading ? <SkeletonMatchCards count={3} /> : filtered.length === 0 ? (
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
          leaderboard={lbSingles}
          onClose={() => setShowRandom(false)}
          onCreate={(prefill) => {
            setShowRandom(false)
            setShowCreate({ prefill })
          }}
          onCreateBatch={handleCreateBatch}
        />
      )}

      {editing && (
        <PkEditModal
          match={editing}
          people={people}
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

export default PkPanel
