import { useEffect, useState } from 'react'
import { api } from '../../../api/client'
import {
  ConfirmModal,
  Modal,
  Panel,
  SkeletonMatchCards,
  SkeletonPlayerGrid,
  SkeletonTable,
} from '../../../components/common'
import { initials } from '../../../utils/appUtils'
import { SeasonAchievements } from '../../../components/SeasonAchievements'
import { EMPTY_SEASON_ACHIEVEMENTS } from '../../../constants/seasonAchievements'
import { RandomMatchmaker } from '../../user/RandomMatchmaker'
import { ResultModal } from '../../user/pk/PkMatch'
import { formatMatchDate, groupMatchesByDate } from '../../user/pk/pkUtils'
import {
  AdminLeaderboardRow,
  AdminQualifyingPlayers,
} from './pk/AdminLeaderboard'
import { AdminMatchCard } from './pk/AdminMatchCard'
import { AdminCreateMatchModal } from './pk/AdminCreateMatchModal'
import { PkEditModal } from './pk/PkEditModal'

const EMPTY_LEADERBOARD = { ranked: [], qualifying: [] }

function VoidResultModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title="Hủy kết quả trận" onClose={onClose}>
      <form className="form" onSubmit={(event) => {
        event.preventDefault()
        if (reason.trim().length >= 5) onConfirm(reason.trim())
      }}>
        <p>
          Kết quả trận đấu sẽ bị loại khỏi mùa.
          Điểm của toàn bộ trận phía sau sẽ được tính lại tự động.
        </p>
        <label>Lý do hủy kết quả
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            required
          />
        </label>
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Đóng</button>
          <button type="submit" className="danger" disabled={reason.trim().length < 5}>
            Xác nhận hủy
          </button>
        </footer>
      </form>
    </Modal>
  )
}

export function PkPanel({ periodId, role }) {
  const [tab, setTab] = useState('leaderboard')
  const [matches, setMatches] = useState([])
  const [achievements, setAchievements] = useState(EMPTY_SEASON_ACHIEVEMENTS)
  const [people, setPeople] = useState([])
  const [leaderboards, setLeaderboards] = useState({
    singles: EMPTY_LEADERBOARD,
    doubles: EMPTY_LEADERBOARD,
  })
  const [matchFilter, setMatchFilter] = useState('upcoming')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [finalizing, setFinalizing] = useState(null)
  const [voiding, setVoiding] = useState(null)
  const [showRandom, setShowRandom] = useState(false)
  const [lbType, setLbType] = useState('doubles')
  const [showCreate, setShowCreate] = useState(false)
  const [matchSearch, setMatchSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [specificDate, setSpecificDate] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadAll() }, [periodId])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  function notify(message, type = 'success') {
    setToastType(type)
    setToast(message)
  }

  async function loadAll() {
    if (!periodId) {
      setMatches([])
      setAchievements(EMPTY_SEASON_ACHIEVEMENTS)
      setPeople([])
      setLeaderboards({ singles: EMPTY_LEADERBOARD, doubles: EMPTY_LEADERBOARD })
      return
    }

    setLoading(true)
    try {
      const [arena, loadedPeople, singles, doubles] = await Promise.all([
        api.pk.arena(periodId),
        api.pk.people(),
        api.pk.leaderboard(periodId, 'singles'),
        api.pk.leaderboard(periodId, 'doubles'),
      ])
      setMatches(arena.matches || [])
      setAchievements(arena.achievements || EMPTY_SEASON_ACHIEVEMENTS)
      setPeople(loadedPeople || [])
      setLeaderboards({ singles, doubles })
    } catch (error) {
      notify(error.message || 'Không tải được dữ liệu đấu trường.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(id, payload) {
    try {
      await api.pk.update(id, payload)
      notify('Đã cập nhật trận đấu.')
      setEditing(null)
      void loadAll()
    } catch (error) { notify(error.message, 'error') }
  }

  async function handleDelete(id) {
    try {
      await api.pk.remove(id)
      notify('Đã xóa trận đấu.')
      setDeleting(null)
      void loadAll()
    } catch (error) { notify(error.message, 'error') }
  }

  async function handleFinalize(id, winnerSide, setScores) {
    try {
      await api.pk.finalize(id, winnerSide, setScores)
      notify('Đã hoàn tất và khóa kết quả trận.')
      setFinalizing(null)
      void loadAll()
    } catch (error) { notify(error.message, 'error') }
  }

  async function handleVoid(id, reason) {
    try {
      await api.pk.voidResult(id, reason)
      notify('Đã hủy kết quả và tính lại bảng xếp hạng.')
      setVoiding(null)
      void loadAll()
    } catch (error) { notify(error.message, 'error') }
  }

  async function handleCreate(payload) {
    try {
      await api.pk.create({ ...payload, period_id: periodId })
      notify('Đã tạo trận đấu.')
      setShowCreate(false)
      setTab('matches')
      void loadAll()
    } catch (error) { notify(error.message, 'error') }
  }

  async function handleCreateBatch(payload) {
    try {
      const created = await api.pk.createBulk(payload, periodId)
      notify(`Đã tạo ${created.length} trận đấu.`)
      setShowRandom(false)
      setTab('matches')
      void loadAll()
    } catch (error) {
      notify(error.message, 'error')
      throw error
    }
  }

  function matchInDateRange(match) {
    const date = new Date(match.played_at || match.created_at)
    const now = new Date()
    if (specificDate) return date.toDateString() === new Date(specificDate).toDateString()
    if (dateFilter === 'today') return date.toDateString() === now.toDateString()
    if (dateFilter === 'week') {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      return date >= start
    }
    if (dateFilter === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }
    return true
  }

  function matchNameSearch(match) {
    if (!matchSearch.trim()) return true
    const query = matchSearch.toLowerCase()
    return [
      match.challenger?.full_name,
      match.challenger?.nickname,
      match.opponent?.full_name,
      match.opponent?.nickname,
      match.challenger_partner?.full_name,
      match.opponent_partner?.full_name,
    ].filter(Boolean).some((name) => name.toLowerCase().includes(query))
  }

  const lbSingles = leaderboards.singles.ranked
  const lbDoubles = leaderboards.doubles.ranked
  const activeLeaderboard = leaderboards[lbType]
  const activeLb = activeLeaderboard.ranked
  const upcoming = matches.filter((match) => match.status === 'pending' || match.status === 'active')
  const completed = matches.filter((match) => match.status === 'completed' && !match.voided_at)
  const cancelled = matches.filter((match) => match.status === 'cancelled' || match.voided_at)
  const baseMatches = matchFilter === 'upcoming'
    ? upcoming
    : matchFilter === 'completed' ? completed : cancelled
  const filteredMatches = baseMatches.filter((match) => matchInDateRange(match) && matchNameSearch(match))
  const filteredPeople = people.filter((person) => {
    const query = memberSearch.trim().toLowerCase()
    return !query || person.full_name?.toLowerCase().includes(query) || person.nickname?.toLowerCase().includes(query)
  })

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/rackets-court.jpg)' }}>
      {toast && <div className={`toast toast-${toastType}`} role="alert">{toast}</div>}

      <div className="pk-arena-hero">
        <div className="pk-arena-hero-bg" />
        <div className="pk-arena-hero-content">
          <span className="pk-arena-hero-eyebrow">QUẢN TRỊ · ROY BADMINTON</span>
          <h2 className="pk-arena-hero-title">Đấu Trường PK</h2>
          <p className="pk-arena-hero-sub">Điều hành trận đấu · Kết quả · Xếp hạng mùa</p>
        </div>
        <span className="pk-arena-hero-deco">🏸</span>
      </div>

      <div className="pk-tabs">
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}>
          🏆 Xếp hạng
        </button>
        <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}>
          ⚔️ Trận đấu <span className="pk-count">{matches.length}</span>
        </button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>
          👥 Thành viên <span className="pk-count">{people.length}</span>
        </button>
      </div>

      {tab === 'leaderboard' && (
        <Panel title="Bảng xếp hạng PK">
          <div className="lb-image-strip">
            <div className="lb-strip-bg" />
            <div className="lb-strip-content">
              <span className="lb-strip-icon">🏆</span>
              <div>
                <div className="lb-strip-title">Bảng vinh danh theo mùa</div>
                <div className="lb-strip-sub">Điểm Elo, sức mạnh đối thủ và thứ tự hoàn tất trận</div>
              </div>
            </div>
          </div>
          <SeasonAchievements achievements={achievements} loading={loading} />
          <div className="lb-type-toggle">
            <button className={lbType === 'doubles' ? 'active' : ''} onClick={() => setLbType('doubles')}>
              Đôi <span className="pk-count">{lbDoubles.length}</span>
            </button>
            <button className={lbType === 'singles' ? 'active' : ''} onClick={() => setLbType('singles')}>
              Đơn <span className="pk-count">{lbSingles.length}</span>
            </button>
          </div>

          {loading ? <SkeletonTable rows={5} cols={7} /> : (
            <>
              {activeLb.length === 0 ? (
                <div className="pk-empty-state">
                  <span className="pk-empty-icon">🏆</span>
                  <p className="pk-empty-title">Chưa có người đủ điều kiện</p>
                  <p className="pk-empty-msg">Cần ít nhất 5 trận và 3 đối thủ khác nhau trong kỳ.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Người chơi</th><th>Thắng</th><th>Thua</th>
                        <th>Tổng</th><th>Bậc</th><th>Điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLb.map((row) => (
                        <AdminLeaderboardRow key={row.id} row={row} achievements={achievements} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <AdminQualifyingPlayers rows={activeLeaderboard.qualifying} />
            </>
          )}
        </Panel>
      )}

      {tab === 'matches' && (
        <Panel title="Trận đấu" action={(
          <div className="pk-admin-actions">
            <button className="pk-create-btn" onClick={() => setShowRandom(true)}>Ghép ngẫu nhiên</button>
            <button className="pk-create-btn" onClick={() => setShowCreate(true)}>+ Tạo trận</button>
          </div>
        )}>
          <div className="pk-filter-tabs">
            <button className={matchFilter === 'upcoming' ? 'active' : ''} onClick={() => setMatchFilter('upcoming')}>
              Sắp tới <span className="pk-count">{upcoming.length}</span>
            </button>
            <button className={matchFilter === 'completed' ? 'active' : ''} onClick={() => setMatchFilter('completed')}>
              Đã diễn ra <span className="pk-count">{completed.length}</span>
            </button>
            <button className={matchFilter === 'cancelled' ? 'active' : ''} onClick={() => setMatchFilter('cancelled')}>
              Đã hủy <span className="pk-count">{cancelled.length}</span>
            </button>
          </div>

          <div className="pk-match-filters">
            <div className="pk-search-wrap">
              <span className="pk-search-icon">⌕</span>
              <input
                className="pk-search-input"
                placeholder="Tìm theo tên người chơi..."
                value={matchSearch}
                onChange={(event) => setMatchSearch(event.target.value)}
              />
              {matchSearch && <button className="pk-search-clear" onClick={() => setMatchSearch('')}>×</button>}
            </div>
            <div className="pk-filter-row">
              {['all', 'today', 'week', 'month'].map((value) => (
                <button
                  key={value}
                  className={`pk-chip${!specificDate && dateFilter === value ? ' pk-chip-active' : ''}`}
                  onClick={() => { setDateFilter(value); setSpecificDate('') }}
                >
                  {value === 'all' ? 'Tất cả ngày' : value === 'today' ? 'Hôm nay' : value === 'week' ? 'Tuần này' : 'Tháng này'}
                </button>
              ))}
              <div className="pk-date-wrap">
                <input
                  type="date"
                  className={`pk-date-input${specificDate ? ' pk-date-active' : ''}`}
                  value={specificDate}
                  onChange={(event) => { setSpecificDate(event.target.value); setDateFilter('all') }}
                />
                {specificDate && (
                  <button className="pk-search-clear pk-date-clear" onClick={() => setSpecificDate('')}>×</button>
                )}
              </div>
            </div>
          </div>

          {loading ? <SkeletonMatchCards count={3} /> : filteredMatches.length === 0 ? (
            <div className="pk-empty-state">
              <span className="pk-empty-icon">🏸</span>
              <p className="pk-empty-title">Không có trận đấu phù hợp</p>
              <p className="pk-empty-msg">Thử thay đổi trạng thái, ngày hoặc tên người chơi.</p>
            </div>
          ) : (
            <div className="pk-day-groups">
              {groupMatchesByDate(filteredMatches).map(({ key, matches: dayMatches }) => (
                <section key={key} className="pk-day-group">
                  <div className="pk-day-header">
                    <span className="pk-day-date">📅 {formatMatchDate(key)}</span>
                    <span className="pk-day-count">{dayMatches.length} trận</span>
                  </div>
                  <div className="pk-match-list">
                    {dayMatches.map((match, dayIndex) => (
                      <AdminMatchCard
                        key={match.id}
                        m={match}
                        displayNumber={dayIndex + 1}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                        onFinalize={setFinalizing}
                        onVoid={setVoiding}
                        canVoid={role === 'owner'}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'players' && (
        <Panel title="Thành viên câu lạc bộ">
          <div className="pk-search-wrap" style={{ marginBottom: 12 }}>
            <span className="pk-search-icon">⌕</span>
            <input
              className="pk-search-input"
              placeholder="Tìm theo tên thành viên..."
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
            {memberSearch && <button className="pk-search-clear" onClick={() => setMemberSearch('')}>×</button>}
          </div>
          {loading ? <SkeletonPlayerGrid count={6} /> : (
            <div className="pk-player-grid">
              {filteredPeople.map((person) => (
                <div key={person.id} className="pk-player-card">
                  {person.avatar_url
                    ? <img src={person.avatar_url} alt={person.full_name} className="avatar large avatar-img pk-player-avatar" />
                    : <span className="avatar large pk-player-avatar">{initials(person.full_name)}</span>}
                  <strong>{person.full_name}</strong>
                  {person.nickname && <small className="muted">“{person.nickname}”</small>}
                  {person.phone && <small className="muted">{person.phone}</small>}
                  <small className="lb-guest-tag">
                    {person.attendance_type === 'fixed' ? 'Cố định' : 'Vãng lai'}
                  </small>
                  <button
                    className="pk-challenge-btn"
                    onClick={() => setShowCreate({ prefill: { opponent_id: person.id } })}
                  >
                    Tạo trận
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

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
          onClose={() => setVoiding(null)}
          onConfirm={(reason) => handleVoid(voiding.id, reason)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Xóa trận"
          message={`Xóa trận giữa ${deleting.challenger?.full_name} và ${deleting.opponent?.full_name}?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => handleDelete(deleting.id)}
        />
      )}
    </div>
  )
}

export default PkPanel
