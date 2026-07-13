import { useEffect, useState } from 'react'
import { api } from '../../../api/client'
import { ConfirmModal, Modal, Panel, SkeletonMatchCards, SkeletonTable } from '../../../components/common'
import { RandomMatchmaker } from '../../user/RandomMatchmaker'
import { ResultModal } from '../../user/pk/PkMatch'
import { STATUS_LABEL } from './pk/pkConstants'
import { AdminLeaderboardRow, AdminLeaderboardLegend, AdminQualifyingPlayers } from './pk/AdminLeaderboard'
import { AdminMatchCard } from './pk/AdminMatchCard'
import { AdminCreateMatchModal } from './pk/AdminCreateMatchModal'
import { PkEditModal } from './pk/PkEditModal'

function sortByDate(arr) {
  return [...arr].sort((a, b) => new Date(b.played_at || b.created_at) - new Date(a.played_at || a.created_at))
}

const EMPTY_LEADERBOARD = { ranked: [], qualifying: [] }

function VoidResultModal({ match, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title="Hủy kết quả trận" onClose={onClose}>
      <form className="form" onSubmit={(event) => {
        event.preventDefault()
        if (reason.trim().length >= 5) onConfirm(reason.trim())
      }}>
        <p>Kết quả trận {match.match_number ? `số ${match.match_number}` : ''} sẽ bị loại khỏi mùa và toàn bộ điểm của các trận sau sẽ được tính lại.</p>
        <label>Lý do hủy kết quả
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} required />
        </label>
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Đóng</button>
          <button type="submit" className="danger" disabled={reason.trim().length < 5}>Xác nhận hủy</button>
        </footer>
      </form>
    </Modal>
  )
}

export function PkPanel({ periodId, role }) {
  const [matches, setMatches]     = useState([])
  const [people, setPeople]       = useState([])
  const [leaderboards, setLeaderboards] = useState({ singles: EMPTY_LEADERBOARD, doubles: EMPTY_LEADERBOARD })
  const [filter, setFilter]       = useState('all')
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState('')
  const [editing, setEditing]     = useState(null)
  const [deleting, setDeleting]   = useState(null)
  const [finalizing, setFinalizing] = useState(null)
  const [voiding, setVoiding] = useState(null)
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
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll() {
    if (!periodId) { setMatches([]); return }
    setLoading(true)
    try {
      const [ms, pp, singles, doubles] = await Promise.all([
        api.pk.matches(periodId).catch(() => []),
        api.pk.people().catch(() => []),
        api.pk.leaderboard(periodId, 'singles').catch(() => EMPTY_LEADERBOARD),
        api.pk.leaderboard(periodId, 'doubles').catch(() => EMPTY_LEADERBOARD),
      ])
      setMatches(ms)
      setPeople(pp)
      setLeaderboards({ singles, doubles })
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

  async function handleFinalize(id, winnerSide, setScores) {
    try {
      await api.pk.finalize(id, winnerSide, setScores)
      setToast('Đã hoàn tất và khóa kết quả trận.')
      setFinalizing(null)
      void loadAll()
    } catch (err) { setToast(err.message) }
  }

  async function handleVoid(id, reason) {
    try {
      await api.pk.voidResult(id, reason)
      setToast('Đã hủy kết quả và tính lại bảng xếp hạng.')
      setVoiding(null)
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

  const lbSingles = leaderboards.singles.ranked
  const lbDoubles = leaderboards.doubles.ranked
  const activeLeaderboard = leaderboards[lbType]
  const activeLb = activeLeaderboard.ranked

  const filtered = sortByDate(
    (filter === 'all' ? matches : matches.filter((m) => m.status === filter))
      .filter((m) => matchInDateRange(m) && matchNameSearch(m))
  )

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
          {loading ? <SkeletonTable rows={5} cols={6} /> : (
            <>
              <AdminLeaderboardLegend />
              {activeLb.length === 0 ? <p className="muted">Chưa có người chơi đủ điều kiện xếp hạng.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Người chơi</th>
                        <th>Thắng</th><th>Thua</th><th>Tổng</th><th>Bậc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLb.map((row) => <AdminLeaderboardRow key={row.id} row={row} />)}
                    </tbody>
                  </table>
                </div>
              )}
              <AdminQualifyingPlayers rows={activeLeaderboard.qualifying} />
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
                  onFinalize={setFinalizing}
                  onVoid={setVoiding}
                  canVoid={role === 'owner'}
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

      {finalizing && (
        <ResultModal
          match={finalizing}
          onClose={() => setFinalizing(null)}
          onSubmit={(winnerSide, setScores) => handleFinalize(finalizing.id, winnerSide, setScores)}
        />
      )}

      {voiding && (
        <VoidResultModal
          match={voiding}
          onClose={() => setVoiding(null)}
          onConfirm={(reason) => handleVoid(voiding.id, reason)}
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
