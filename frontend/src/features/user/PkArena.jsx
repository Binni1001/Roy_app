import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { ConfirmModal, Modal, Panel } from '../../components/common'
import { formatDate, initials } from '../../utils/appUtils'
import { RandomMatchmaker } from './RandomMatchmaker'

/* ── Leaderboard tier helpers ── */
const TIERS = [
  { label: '🥇', cls: 'lb-tier-gold',    min: 1, max: 1 },
  { label: '🥈', cls: 'lb-tier-silver',  min: 2, max: 2 },
  { label: '🥉', cls: 'lb-tier-bronze',  min: 3, max: 3 },
]

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

function LeaderboardRow({ row, isMe, total }) {
  const tierCls = getTierCls(row.rank, total)
  return (
    <tr className={`${isMe ? 'pk-row-me' : ''} ${tierCls}`}>
      <td><RankBadge rank={row.rank} total={total} /></td>
      <td>
        <div className="pk-person-cell">
          {row.avatar_url
            ? <img src={row.avatar_url} className="avatar avatar-img pk-avatar" alt={row.full_name} />
            : <span className="avatar pk-avatar">{initials(row.full_name)}</span>}
          <span>{row.full_name}{row.nickname ? <small className="muted"> · {row.nickname}</small> : null}</span>
        </div>
      </td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td className="lb-points"><span className="lb-points-chip">{row.points ?? '—'}</span></td>
      <td><WilsonBar score={row.wilson_score} /></td>
    </tr>
  )
}

function LeaderboardLegend({ total, onShowGuide }) {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item"><span className="lb-dot lb-dot-gold" />Top 3</span>
      <span className="lb-legend-item"><span className="lb-dot lb-dot-mid" />Trung bình</span>
      {total >= 5 && <span className="lb-legend-item"><span className="lb-dot lb-dot-bottom" />Cần cố gắng</span>}
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">★ Chỉ số Wilson — đánh nhiều trận mới được điểm cao</span>
      <button className="lb-guide-btn" onClick={onShowGuide}>❓ Cách xếp hạng</button>
    </div>
  )
}

function RankingGuideModal({ onClose }) {
  return (
    <Modal title="🏆 Cách tính xếp hạng" onClose={onClose}>
      <div className="rg-root">
        <p className="rg-intro">
          Xếp hạng dựa trên <strong>Chỉ số ★</strong> — không phải số trận thắng đơn thuần.
          Chỉ số này trả lời câu hỏi:
        </p>
        <div className="rg-quote">
          "Nếu người này đánh lâu dài, tỷ lệ thắng tối thiểu của họ là bao nhiêu?"
        </div>

        <p className="rg-section-title">📌 Ví dụ thực tế</p>

        <div className="rg-example-grid">
          <div className="rg-example-card rg-card-win">
            <div className="rg-card-name">Anh Lâm</div>
            <div className="rg-card-record">2 thắng · 0 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>34%</strong></div>
            <div className="rg-card-note">Chưa thua lần nào → chỉ số cao → <strong>#1</strong></div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Anh Thế</div>
            <div className="rg-card-record">3 thắng · 1 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>30%</strong></div>
            <div className="rg-card-note">Thắng nhiều hơn nhưng đã thua 1 lần → chỉ số thấp hơn Lâm</div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Bin</div>
            <div className="rg-card-record">2 thắng · 2 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>15%</strong></div>
            <div className="rg-card-note">Tỷ lệ thắng 50/50 → chỉ số trung bình</div>
          </div>
          <div className="rg-example-card rg-card-loss">
            <div className="rg-card-name">Anh Khanh</div>
            <div className="rg-card-record">2 thắng · 3 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>11%</strong></div>
            <div className="rg-card-note">Thua nhiều hơn thắng → chỉ số thấp nhất</div>
          </div>
        </div>

        <p className="rg-section-title">💡 Quy tắc đơn giản</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">📈</span><span>Đánh <strong>càng nhiều trận</strong>, chỉ số càng chính xác và tăng lên</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🔥</span><span>Thắng liên tiếp → leo hạng nhanh</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">📉</span><span>Thua nhiều → chỉ số tụt ngay dù trước đó thắng nhiều</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🆕</span><span>Mới vào thắng 1 trận <strong>không thể leo #1</strong> — phải chứng minh qua nhiều trận</span></div>
        </div>

        <div className="rg-footer">
          Điểm (+3 thắng / -1 thua) chỉ dùng để phân biệt khi 2 người có chỉ số bằng nhau.
        </div>
      </div>
    </Modal>
  )
}

const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  active: 'Đang diễn ra',
  completed: 'Đã kết thúc',
  cancelled: 'Đã hủy',
}

function sortByDate(arr) {
  return [...arr].sort((a, b) => {
    const da = a.played_at || a.created_at
    const db = b.played_at || b.created_at
    return new Date(db) - new Date(da)
  })
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getResultLock(m) {
  const now = new Date()
  const today = startOfDay(now)
  if (!m.played_at) return { canRecord: false, reason: 'Kèo chưa có ngày đấu' }
  const matchDay = startOfDay(new Date(m.played_at))
  if (matchDay > today) return { canRecord: false, reason: `Chưa đến ngày đấu (${formatDate(m.played_at)})` }
  if (m.status === 'completed' && m.updated_at) {
    const diffHours = (now - new Date(m.updated_at)) / (1000 * 60 * 60)
    if (diffHours > 24) return { canRecord: false, reason: 'Kết quả đã khoá sau 24 giờ' }
  }
  return { canRecord: true, reason: null }
}

function isParticipant(m, activePerson) {
  if (!activePerson) return false
  return [m.challenger_id, m.opponent_id, m.challenger_partner_id, m.opponent_partner_id]
    .filter(Boolean)
    .includes(activePerson.id)
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

function MatchCard({ m, activePerson, onSetResult, onCancel }) {
  const amParticipant = isParticipant(m, activePerson)
  const { canRecord, reason } = getResultLock(m)
  const challengerWon = m.winner_side === 'challenger'
  const opponentWon   = m.winner_side === 'opponent'

  return (
    <div className={`pk-match-card pk-match-card-v2 pk-status-${m.status}`}>
      {/* Header row */}
      <div className="pk-card-header">
        <span className={`pk-badge pk-badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
        <span className="pk-badge pk-badge-type">{m.match_type === 'singles' ? '⚔ Đơn' : '🤝 Đôi'}</span>
        {m.played_at && <span className="pk-card-date">📅 {formatDate(m.played_at)}</span>}
      </div>

      {/* VS row */}
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
            <span className="pk-score-label">
              {challengerWon ? '1 – 0' : '0 – 1'}
            </span>
          )}
        </div>
        <TeamBlock
          main={m.opponent}
          partner={m.opponent_partner}
          label="Đối thủ"
          isWinner={m.status === 'completed' && opponentWon}
        />
      </div>

      {/* Footer */}
      {(m.bet_items || m.note || amParticipant) && (
        <div className="pk-card-footer">
          {m.bet_items && <span className="pk-bet">🎁 {m.bet_items}</span>}
          {m.note      && <span className="pk-note muted">{m.note}</span>}

          {amParticipant && (m.status === 'pending' || m.status === 'active') && (
            <div className="pk-match-actions">
              <span title={!canRecord ? reason : undefined}>
                <button onClick={() => onSetResult(m)} disabled={!canRecord}>Ghi kết quả</button>
              </span>
              {!canRecord && reason && <small className="muted pk-lock-hint">{reason}</small>}
              <button className="danger" onClick={() => onCancel(m.id)}>Hủy kèo</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PkArena({ activePerson }) {
  const [tab, setTab]             = useState('leaderboard')
  const [matchFilter, setMatchFilter] = useState('upcoming')
  const [leaderboard, setLeaderboard] = useState([])
  const [matches, setMatches]     = useState([])
  const [people, setPeople]       = useState([])
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showRandom, setShowRandom] = useState(false)
  const [showGuide, setShowGuide]   = useState(false)
  const [myMatchesOnly, setMyMatchesOnly] = useState(false)
  const [matchSearch, setMatchSearch]     = useState('')
  const [dateFilter, setDateFilter]       = useState('all')
  const [specificDate, setSpecificDate]   = useState('')
  const [showResult, setShowResult] = useState(null)
  const [cancelId, setCancelId]   = useState(null)
  const [form, setForm] = useState({
    match_type: 'singles',
    opponent_id: '',
    challenger_partner_id: '',
    opponent_partner_id: '',
    bet_items: '',
    played_at: '',
    note: '',
  })

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAll() {
    setLoading(true)
    try {
      const [lb, ms, pp] = await Promise.all([
        api.pk.leaderboard().catch(() => []),
        api.pk.matches().catch(() => []),   // tất cả kèo, không chỉ của mình
        api.pk.people().catch(() => []),
      ])
      setLeaderboard(lb)
      setMatches(ms)
      setPeople(pp)
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
        challenger_id: activePerson.id,
        challenger_partner_id: form.match_type === 'doubles' ? form.challenger_partner_id : undefined,
        opponent_partner_id:   form.match_type === 'doubles' ? form.opponent_partner_id   : undefined,
      })
      setToast('Đã tạo kèo thách đấu!')
      setShowCreate(false)
      setForm({ match_type: 'singles', opponent_id: '', challenger_partner_id: '', opponent_partner_id: '', bet_items: '', played_at: '', note: '' })
      void loadAll()
    } catch (err) { setToast(err.message) }
  }

  async function handleSetWinner(matchId, winnerSide) {
    try {
      await api.pk.update(matchId, { winner_side: winnerSide, status: 'completed' })
      setToast('Đã ghi nhận kết quả!')
      setShowResult(null)
      void loadAll()
    } catch (err) { setToast(err.message) }
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
      setToast('Đã hủy kèo.')
      setCancelId(null)
      void loadAll()
    } catch (err) { setToast(err.message) }
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

  const upcoming  = sortByDate(matches.filter((m) => m.status === 'pending' || m.status === 'active'))
  const completed = sortByDate(matches.filter((m) => m.status === 'completed'))
  const cancelled = sortByDate(matches.filter((m) => m.status === 'cancelled'))
  const baseList  = matchFilter === 'upcoming' ? upcoming : matchFilter === 'completed' ? completed : cancelled
  const filteredMatches = useMemo(() => applyFilters(baseList), [baseList, myMatchesOnly, matchSearch, dateFilter])
  const otherPeople = people.filter((p) => p.id !== activePerson?.id)

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/player-fist.jpg)' }}>
      {toast && <div className="toast" role="alert">{toast}</div>}

      <div className="pk-tabs">
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}>Bảng xếp hạng</button>
        <button className={tab === 'matches'     ? 'active' : ''} onClick={() => setTab('matches')}>Kèo đấu</button>
        <button className={tab === 'players'     ? 'active' : ''} onClick={() => setTab('players')}>Thành viên</button>
      </div>

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <Panel title="Bảng xếp hạng PK">
          {loading ? <p className="muted">Đang tải...</p> : leaderboard.length === 0 ? (
            <p className="muted">Chưa có dữ liệu xếp hạng. Hãy tạo kèo đầu tiên!</p>
          ) : (
            <>
              <LeaderboardLegend total={leaderboard.length} onShowGuide={() => setShowGuide(true)} />
              {showGuide && <RankingGuideModal onClose={() => setShowGuide(false)} />}
              <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Người chơi</th>
                    <th>Thắng</th><th>Thua</th><th>Tổng</th>
                    <th title="Điểm tích lũy: +3 mỗi trận thắng, -1 mỗi trận thua">Điểm</th>
                    <th title="Wilson Score: xếp hạng thống kê, người ít trận bị kéo về trung bình">Chỉ số ★</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <LeaderboardRow key={row.id} row={row} isMe={row.id === activePerson?.id} total={leaderboard.length} />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Panel>
      )}

      {/* ── ALL MATCHES ── */}
      {tab === 'matches' && (
        <Panel title="Kèo đấu"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
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

          {loading ? <p className="muted">Đang tải...</p> : filteredMatches.length === 0 ? (
            <p className="muted">
              {matchFilter === 'upcoming'  && 'Chưa có kèo nào sắp tới.'}
              {matchFilter === 'completed' && 'Chưa có trận đấu nào kết thúc.'}
              {matchFilter === 'cancelled' && 'Không có kèo nào bị hủy.'}
            </p>
          ) : (
            <div className="pk-match-list">
              {filteredMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  m={m}
                  activePerson={activePerson}
                  onSetResult={setShowResult}
                  onCancel={(id) => setCancelId(id)}
                />
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── PLAYERS ── */}
      {tab === 'players' && (
        <Panel title="Thành viên câu lạc bộ">
          {loading ? <p className="muted">Đang tải...</p> : (
            <div className="pk-player-grid">
              {people.map((p) => (
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
          leaderboard={leaderboard}
          onClose={() => setShowRandom(false)}
          onCreate={handleRandomResult}
        />
      )}

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <section className="modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Tạo kèo thách đấu</h2>
              <button className="icon-button" onClick={() => setShowCreate(false)}>×</button>
            </header>
            <form className="form" onSubmit={handleCreate}>
              <label>Hình thức
                <select value={form.match_type} onChange={(e) => updateForm('match_type', e.target.value)}>
                  <option value="singles">Đánh đơn</option>
                  <option value="doubles">Đánh đôi</option>
                </select>
              </label>
              <label>Đối thủ *
                <select value={form.opponent_id} onChange={(e) => updateForm('opponent_id', e.target.value)} required>
                  <option value="">Chọn đối thủ</option>
                  {otherPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                </select>
              </label>
              {form.match_type === 'doubles' && (<>
                <label>Đồng đội của tôi *
                  <select value={form.challenger_partner_id} onChange={(e) => updateForm('challenger_partner_id', e.target.value)} required>
                    <option value="">Chọn đồng đội</option>
                    {otherPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                  </select>
                </label>
                <label>Đồng đội đối thủ *
                  <select value={form.opponent_partner_id} onChange={(e) => updateForm('opponent_partner_id', e.target.value)} required>
                    <option value="">Chọn đồng đội đối thủ</option>
                    {otherPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>)}
                  </select>
                </label>
              </>)}
              <label>Vật phẩm cược
                <input type="text" value={form.bet_items} onChange={(e) => updateForm('bet_items', e.target.value)} placeholder="VD: 2 chai nước, 1 ổ bánh mì" />
              </label>
              <label>Ngày đấu *
                <input type="date" value={form.played_at} onChange={(e) => updateForm('played_at', e.target.value)} required />
              </label>
              <label>Ghi chú
                <input type="text" value={form.note} onChange={(e) => updateForm('note', e.target.value)} placeholder="Tuỳ chọn" />
              </label>
              <footer className="modal-actions">
                <button type="button" onClick={() => setShowCreate(false)}>Hủy</button>
                <button type="submit">Tạo kèo</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {showResult && (
        <Modal title="Ghi nhận kết quả" onClose={() => setShowResult(null)}>
          <div className="form">
            <p>Ai thắng?</p>
            <div className="pk-winner-choice">
              <button onClick={() => handleSetWinner(showResult.id, 'challenger')}>
                {showResult.challenger?.full_name}{showResult.challenger_partner ? ` & ${showResult.challenger_partner.full_name}` : ''}
                <small> (bên thách đấu)</small>
              </button>
              <button onClick={() => handleSetWinner(showResult.id, 'opponent')}>
                {showResult.opponent?.full_name}{showResult.opponent_partner ? ` & ${showResult.opponent_partner.full_name}` : ''}
                <small> (bên đối thủ)</small>
              </button>
            </div>
          </div>
        </Modal>
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
    </div>
  )
}
