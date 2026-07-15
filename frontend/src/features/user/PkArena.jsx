import { useEffect, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { api } from '../../api/client'
import { ConfirmModal, Panel, SkeletonMatchCards, SkeletonPlayerGrid, SkeletonTable } from '../../components/common'
import { initials } from '../../utils/appUtils'
import { RandomMatchmaker } from './RandomMatchmaker'
import { LeaderboardRow, QualifyingPlayers, RankingGuideModal } from './pk/PkLeaderboard'
import { MatchCard, ResultModal, UserEditModal } from './pk/PkMatch'
import { CreateMatchModal } from './pk/CreateMatchModal'
import { sortByDate, groupMatchesByDate, formatMatchDate } from './pk/pkUtils'

const EMPTY_LEADERBOARD = { ranked: [], qualifying: [], requirements: { min_matches: 5, min_opponents: 3 } }

export function PkArena({ activePerson, periodId }) {
  const [tab, setTab]             = useState('leaderboard')
  const [matchFilter, setMatchFilter] = useState('upcoming')
  const [matches, setMatches]     = useState([])
  const [people, setPeople]       = useState([])
  const [leaderboards, setLeaderboards] = useState({
    singles: EMPTY_LEADERBOARD,
    doubles: EMPTY_LEADERBOARD,
  })
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState('')
  const [toastType, setToastType] = useState('success')
  const [showCreate, setShowCreate] = useState(false)
  const [showRandom, setShowRandom] = useState(false)
  const [showGuide, setShowGuide]   = useState(false)
  const [lbType, setLbType]         = useState('singles')
  const [myMatchesOnly, setMyMatchesOnly] = useState(false)
  const [matchSearch, setMatchSearch]     = useState('')
  const [dateFilter, setDateFilter]       = useState('all')
  const [specificDate, setSpecificDate]   = useState('')
  const [showResult, setShowResult]   = useState(null)
  const [cancelId, setCancelId]       = useState(null)
  const [startingId, setStartingId]   = useState(null)
  const [editingMatch, setEditingMatch] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [form, setForm] = useState({
    match_type: 'singles',
    opponent_id: '',
    challenger_partner_id: '',
    opponent_partner_id: '',
    sets: 1,
    bet_items: '',
    played_at: '',
    note: '',
  })

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

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.opponent_id) { setToast('Vui lòng chọn đối thủ'); return }
    if (form.opponent_id === activePerson?.id) { setToast('Không thể thách đấu chính mình'); return }
    try {
      await api.pk.create({
        ...form,
        period_id: periodId,
        challenger_id: activePerson.id,
        sets: Number(form.sets) || 1,
        challenger_partner_id: form.match_type === 'doubles' ? form.challenger_partner_id : undefined,
        opponent_partner_id:   form.match_type === 'doubles' ? form.opponent_partner_id   : undefined,
      })
      setToastType('success'); setToast('Đã tạo kèo thách đấu!')
      setShowCreate(false)
      setForm({ match_type: 'singles', opponent_id: '', challenger_partner_id: '', opponent_partner_id: '', sets: 1, bet_items: '', played_at: '', note: '' })
      void loadAll()
    } catch (err) { setToastType('error'); setToast(err.message) }
  }

  async function handleSetWinner(matchId, winnerSide, setScores) {
    try {
      await api.pk.finalize(matchId, winnerSide, setScores)
      setToastType('success'); setToast('Đã ghi nhận kết quả!')
      setShowResult(null)
      void loadAll()
    } catch (err) { setToastType('error'); setToast(err.message) }
  }

  async function handleRandomBatch(payload) {
    try {
      const created = await api.pk.createBulk(payload, periodId)
      setToastType('success'); setToast(`Đã tạo ${created.length} kèo!`)
      void loadAll()
    } catch (err) { setToastType('error'); setToast(err.message); throw err }
  }

  function handleRandomResult(prefill) {
    setForm((f) => ({
      ...f,
      match_type: prefill.match_type || 'singles',
      opponent_id: prefill.opponent_id || '',
      challenger_partner_id: prefill.challenger_partner_id || '',
      opponent_partner_id: prefill.opponent_partner_id || '',
    }))
    setShowCreate(true)
  }

  async function handleCancel(matchId) {
    try {
      await api.pk.update(matchId, { status: 'cancelled' })
      setToastType('success'); setToast('Đã hủy kèo.')
      setCancelId(null)
      void loadAll()
    } catch (err) { setToastType('error'); setToast(err.message) }
  }

  async function handleStart(matchId) {
    try {
      await api.pk.update(matchId, { status: 'active' })
      setToastType('success'); setToast('Kèo đấu đã bắt đầu!')
      setStartingId(null)
      void loadAll()
    } catch (err) { setToastType('error'); setToast(err.message) }
  }

  async function handleEditMatch(matchId, payload) {
    try {
      await api.pk.update(matchId, payload)
      setToastType('success'); setToast('Đã cập nhật kèo.')
      setEditingMatch(null)
      void loadAll()
    } catch (err) { setToastType('error'); setToast(err.message) }
  }

  const myId = activePerson?.id

  function matchInDateRange(m) {
    const d = new Date(m.played_at || m.created_at)
    const now = new Date()
    if (specificDate) return d.toDateString() === new Date(specificDate).toDateString()
    if (dateFilter === 'today') return d.toDateString() === now.toDateString()
    if (dateFilter === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay())
      return d >= start
    }
    if (dateFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return true
  }

  function matchInvolvesMe(m) {
    return m.challenger_id === myId || m.opponent_id === myId ||
      m.challenger_partner_id === myId || m.opponent_partner_id === myId
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

  function applyFilters(arr) {
    return arr.filter((m) =>
      matchInDateRange(m) &&
      (!myMatchesOnly || matchInvolvesMe(m)) &&
      matchNameSearch(m)
    )
  }

  const lbSingles = leaderboards.singles.ranked
  const lbDoubles = leaderboards.doubles.ranked
  const activeLeaderboard = leaderboards[lbType]
  const activeLb = activeLeaderboard.ranked

  const upcoming  = sortByDate(matches.filter((m) => m.status === 'pending' || m.status === 'active'))
  const completed = sortByDate(matches.filter((m) => m.status === 'completed'))
  const cancelled = sortByDate(matches.filter((m) => m.status === 'cancelled'))
  const baseList  = matchFilter === 'upcoming' ? upcoming : matchFilter === 'completed' ? completed : cancelled
  const filteredMatches = applyFilters(baseList)
  const otherPeople = people.filter((p) => p.id !== activePerson?.id)

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/rackets-court.jpg)' }}>
      {toast && <div className={`toast toast-${toastType}`} role="alert">{toast}</div>}

      {/* Arena hero banner */}
      <div className="pk-arena-hero">
        <div className="pk-arena-hero-bg" />
        <div className="pk-arena-hero-content">
          <span className="pk-arena-hero-eyebrow">⚔️ Roy Badminton</span>
          <h2 className="pk-arena-hero-title">Đấu Trường PK</h2>
          <p className="pk-arena-hero-sub">Thách đấu · Bảng xếp hạng · Vinh quang</p>
        </div>
        <span className="pk-arena-hero-deco">🏸</span>
      </div>

      <div className="pk-tabs">
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}>🏆 Xếp hạng</button>
        <button className={tab === 'matches'     ? 'active' : ''} onClick={() => setTab('matches')}>⚔️ Kèo đấu</button>
        <button className={tab === 'players'     ? 'active' : ''} onClick={() => setTab('players')}>👥 Thành viên</button>
      </div>

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <Panel title="Bảng xếp hạng PK">
          <div className="lb-image-strip">
            <div className="lb-strip-bg" />
            <div className="lb-strip-content">
              <span className="lb-strip-icon">🏆</span>
              <div>
                <div className="lb-strip-title">Bảng vinh danh</div>
                <div className="lb-strip-sub">Xếp hạng theo mùa, sức mạnh đối thủ và thứ tự hoàn tất trận</div>
              </div>
              <button className="lb-strip-guide" onClick={() => setShowGuide(true)} title="Cách xếp hạng">
                <CircleHelp size={16} aria-hidden="true" />
                <span>Cách xếp hạng</span>
              </button>
            </div>
          </div>
          {showGuide && <RankingGuideModal onClose={() => setShowGuide(false)} />}
          <div className="lb-type-toggle">
            <button className={lbType === 'singles' ? 'active' : ''} onClick={() => setLbType('singles')}>
              ⚔️ Đơn <span className="pk-count">{lbSingles.length}</span>
            </button>
            <button className={lbType === 'doubles' ? 'active' : ''} onClick={() => setLbType('doubles')}>
              🤝 Đôi <span className="pk-count">{lbDoubles.length}</span>
            </button>
          </div>

          {loading ? <SkeletonTable rows={5} cols={7} /> : (
            <>
              {activeLb.length === 0 ? (
                <p className="muted">Chưa có người chơi đủ điều kiện xếp hạng {lbType === 'singles' ? 'đơn' : 'đôi'}.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Người chơi</th>
                        <th>Thắng</th><th>Thua</th><th>Tổng</th><th>Bậc</th><th>Điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLb.map((row) => (
                        <LeaderboardRow key={row.id} row={row} isMe={row.id === activePerson?.id} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <QualifyingPlayers rows={activeLeaderboard.qualifying} activePersonId={activePerson?.id} />
            </>
          )}
        </Panel>
      )}

      {/* ── ALL MATCHES ── */}
      {tab === 'matches' && (
        <Panel title="Kèo đấu"
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="pk-create-btn" onClick={() => setShowRandom(true)}>🎲 Ghép ngẫu nhiên</button>
              <button className="pk-create-btn" onClick={() => setShowCreate(true)}>+ Thách đấu mới</button>
            </div>
          }
        >
          <div className="pk-filter-tabs">
            <button className={matchFilter === 'upcoming'  ? 'active' : ''} onClick={() => setMatchFilter('upcoming')}>
              Sắp tới {upcoming.length > 0 && <span className="pk-count">{upcoming.length}</span>}
            </button>
            <button className={matchFilter === 'completed' ? 'active' : ''} onClick={() => setMatchFilter('completed')}>
              Đã diễn ra {completed.length > 0 && <span className="pk-count">{completed.length}</span>}
            </button>
            <button className={matchFilter === 'cancelled' ? 'active' : ''} onClick={() => setMatchFilter('cancelled')}>
              Đã hủy {cancelled.length > 0 && <span className="pk-count">{cancelled.length}</span>}
            </button>
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
              <button className={`pk-chip${myMatchesOnly ? ' pk-chip-active' : ''}`} onClick={() => setMyMatchesOnly((v) => !v)}>
                👤 Của tôi
              </button>
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

          {loading ? <SkeletonMatchCards count={3} /> : filteredMatches.length === 0 ? (
            <div className="pk-empty-state">
              <span className="pk-empty-icon">🏸</span>
              <p className="pk-empty-title">Chưa có trận đấu nào</p>
              <p className="pk-empty-msg">
                {matchFilter === 'upcoming'  && 'Tạo một trận thách đấu mới để bắt đầu Đấu trường Roy Badminton.'}
                {matchFilter === 'completed' && 'Chưa có trận đấu nào kết thúc.'}
                {matchFilter === 'cancelled' && 'Không có kèo nào bị hủy.'}
              </p>
              {matchFilter === 'upcoming' && (
                <button className="pk-create-btn" onClick={() => setShowCreate(true)}>+ Thách đấu mới</button>
              )}
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
                    {dayMatches.map((m, dayIndex) => (
                      <MatchCard
                        key={m.id}
                        m={m}
                        matchNumber={dayIndex + 1}
                        activePerson={activePerson}
                        onSetResult={setShowResult}
                        onCancel={(id) => setCancelId(id)}
                        onStart={(id) => setStartingId(id)}
                        onEdit={(match) => setEditingMatch(match)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── PLAYERS ── */}
      {tab === 'players' && (
        <Panel title="Thành viên câu lạc bộ">
          <div className="pk-search-wrap" style={{ marginBottom: 12 }}>
            <span className="pk-search-icon">🔍</span>
            <input className="pk-search-input" placeholder="Tìm theo tên..."
              value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
            {memberSearch && <button className="pk-search-clear" onClick={() => setMemberSearch('')}>×</button>}
          </div>
          {loading ? <SkeletonPlayerGrid count={6} /> : (
            <div className="pk-player-grid">
              {people.filter((p) => !memberSearch || p.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) || p.nickname?.toLowerCase().includes(memberSearch.toLowerCase())).map((p) => (
                <div key={p.id} className={`pk-player-card${p.id === activePerson?.id ? ' pk-player-me' : ''}`}>
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt={p.full_name} className="avatar large avatar-img pk-player-avatar" />
                    : <span className="avatar large pk-player-avatar">{initials(p.full_name)}</span>}
                  <strong>{p.full_name}</strong>
                  {p.nickname && <small className="muted">"{p.nickname}"</small>}
                  {p.phone    && <small className="muted">{p.phone}</small>}
                  {p.gender   && <small className="muted">{p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : 'Khác'}</small>}
                  {p.bio      && <p className="pk-player-bio">{p.bio}</p>}
                  {p.id !== activePerson?.id ? (
                    <button className="pk-challenge-btn" onClick={() => {
                      setForm((f) => ({ ...f, opponent_id: p.id }))
                      setTab('matches')
                      setShowCreate(true)
                    }}>Thách đấu</button>
                  ) : (
                    <span className="muted pk-you-tag">Bạn</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── MODALS ── */}
      {showRandom && (
        <RandomMatchmaker
          people={people}
          leaderboard={lbSingles}
          onClose={() => setShowRandom(false)}
          onCreate={handleRandomResult}
          onCreateBatch={handleRandomBatch}
          lockedPerson={activePerson}
        />
      )}

      {showCreate && (
        <CreateMatchModal
          form={form}
          updateForm={updateForm}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          activePerson={activePerson}
          otherPeople={otherPeople}
        />
      )}

      {showResult && (
        <ResultModal
          match={showResult}
          onClose={() => setShowResult(null)}
          onSubmit={(winnerSide, setScores) => handleSetWinner(showResult.id, winnerSide, setScores)}
        />
      )}

      {cancelId && (
        <ConfirmModal
          title="Hủy kèo"
          message="Bạn chắc chắn muốn hủy kèo này?"
          confirmText="Hủy kèo"
          danger
          onClose={() => setCancelId(null)}
          onConfirm={() => handleCancel(cancelId)}
        />
      )}

      {startingId && (
        <ConfirmModal
          title="Bắt đầu đấu"
          message="Xác nhận bắt đầu trận đấu? Kèo sẽ chuyển sang trạng thái đang diễn ra."
          confirmText="▶ Bắt đầu"
          onClose={() => setStartingId(null)}
          onConfirm={() => handleStart(startingId)}
        />
      )}

      {editingMatch && (
        <UserEditModal
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSubmit={(payload) => handleEditMatch(editingMatch.id, payload)}
        />
      )}
    </div>
  )
}

export default PkArena
