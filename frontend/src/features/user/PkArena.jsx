import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Panel } from '../../components/common'
import { formatDate, initials } from '../../utils/appUtils'

const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  active: 'Đang diễn ra',
  completed: 'Đã kết thúc',
  cancelled: 'Đã hủy',
}

const WINNER_LABEL = { challenger: 'Bên thách đấu thắng', opponent: 'Bên đối thủ thắng' }

export function PkArena({ activePerson }) {
  const [tab, setTab] = useState('leaderboard')
  const [leaderboard, setLeaderboard] = useState([])
  const [matches, setMatches] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showResult, setShowResult] = useState(null)
  const [form, setForm] = useState({
    match_type: 'singles',
    opponent_id: '',
    challenger_partner_id: '',
    opponent_partner_id: '',
    bet_items: '',
    played_at: '',
    note: '',
  })

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function loadAll() {
    setLoading(true)
    try {
      const [lb, ms, pp] = await Promise.all([
        api.pk.leaderboard().catch(() => []),
        api.pk.myMatches().catch(() => []),
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
        opponent_partner_id: form.match_type === 'doubles' ? form.opponent_partner_id : undefined,
      })
      setToast('Đã tạo kèo thách đấu!')
      setShowCreate(false)
      setForm({ match_type: 'singles', opponent_id: '', challenger_partner_id: '', opponent_partner_id: '', bet_items: '', played_at: '', note: '' })
      void loadAll()
    } catch (err) {
      setToast(err.message)
    }
  }

  async function handleSetWinner(matchId, winnerSide) {
    try {
      await api.pk.update(matchId, { winner_side: winnerSide, status: 'completed' })
      setToast('Đã ghi nhận kết quả!')
      setShowResult(null)
      void loadAll()
    } catch (err) {
      setToast(err.message)
    }
  }

  async function handleCancel(matchId) {
    try {
      await api.pk.update(matchId, { status: 'cancelled' })
      setToast('Đã hủy kèo.')
      void loadAll()
    } catch (err) {
      setToast(err.message)
    }
  }

  // Server đã lọc kèo theo người dùng hiện tại qua /api/pk-matches/me
  const myMatches = matches

  const otherPeople = people.filter((p) => p.id !== activePerson?.id)

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/player-fist.jpg)' }}>
      {toast && <div className="toast" role="alert">{toast}</div>}

      {/* Sub-tabs */}
      <div className="pk-tabs">
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}>Bảng xếp hạng</button>
        <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}>Kèo của tôi</button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>Thành viên</button>
      </div>

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <Panel title="Bảng xếp hạng PK">
          {loading ? <p className="muted">Đang tải...</p> : leaderboard.length === 0 ? (
            <p className="muted">Chưa có dữ liệu xếp hạng. Hãy tạo kèo đầu tiên!</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Người chơi</th>
                    <th>Thắng</th>
                    <th>Thua</th>
                    <th>Tổng</th>
                    <th>Tỉ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.id} className={row.id === activePerson?.id ? 'pk-row-me' : ''}>
                      <td><strong className={row.rank <= 3 ? 'pk-rank-top' : ''}>{row.rank}</strong></td>
                      <td>
                        <div className="pk-person-cell">
                          {row.avatar_url
                            ? <img src={row.avatar_url} className="avatar avatar-img pk-avatar" alt={row.full_name} />
                            : <span className="avatar pk-avatar">{initials(row.full_name)}</span>
                          }
                          <span>{row.full_name}{row.nickname ? <small className="muted"> · {row.nickname}</small> : null}</span>
                        </div>
                      </td>
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
      )}

      {/* ── MY MATCHES ── */}
      {tab === 'matches' && (
        <Panel title="Kèo của tôi">
          <button className="pk-create-btn" onClick={() => setShowCreate(true)}>+ Thách đấu mới</button>

          {showCreate && (
            <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
              <section className="modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
                <header className="modal-header">
                  <h2>Tạo kèo thách đấu</h2>
                  <button className="icon-button" onClick={() => setShowCreate(false)}>×</button>
                </header>
                <form className="form" onSubmit={handleCreate}>
                  <label>
                    Hình thức
                    <select value={form.match_type} onChange={(e) => updateForm('match_type', e.target.value)}>
                      <option value="singles">Đánh đơn</option>
                      <option value="doubles">Đánh đôi</option>
                    </select>
                  </label>
                  <label>
                    Đối thủ *
                    <select value={form.opponent_id} onChange={(e) => updateForm('opponent_id', e.target.value)} required>
                      <option value="">Chọn đối thủ</option>
                      {otherPeople.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>
                      ))}
                    </select>
                  </label>
                  {form.match_type === 'doubles' && (
                    <>
                      <label>
                        Đồng đội của tôi *
                        <select value={form.challenger_partner_id} onChange={(e) => updateForm('challenger_partner_id', e.target.value)} required>
                          <option value="">Chọn đồng đội</option>
                          {otherPeople.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Đồng đội đối thủ *
                        <select value={form.opponent_partner_id} onChange={(e) => updateForm('opponent_partner_id', e.target.value)} required>
                          <option value="">Chọn đồng đội đối thủ</option>
                          {otherPeople.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name}{p.nickname ? ` (${p.nickname})` : ''}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    Vật phẩm cược (nước, bánh mì, ...)
                    <input
                      type="text"
                      value={form.bet_items}
                      onChange={(e) => updateForm('bet_items', e.target.value)}
                      placeholder="VD: 2 chai nước, 1 ổ bánh mì"
                    />
                  </label>
                  <label>
                    Ngày đấu
                    <input type="date" value={form.played_at} onChange={(e) => updateForm('played_at', e.target.value)} />
                  </label>
                  <label>
                    Ghi chú
                    <input type="text" value={form.note} onChange={(e) => updateForm('note', e.target.value)} placeholder="Tuỳ chọn" />
                  </label>
                  <button type="submit">Tạo kèo</button>
                </form>
              </section>
            </div>
          )}

          {showResult && (
            <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowResult(null)}>
              <section className="modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
                <header className="modal-header">
                  <h2>Ghi nhận kết quả</h2>
                  <button className="icon-button" onClick={() => setShowResult(null)}>×</button>
                </header>
                <div className="form">
                  <p>Ai thắng?</p>
                  <div className="pk-winner-choice">
                    <button onClick={() => handleSetWinner(showResult.id, 'challenger')}>
                      {showResult.challenger?.full_name}
                      {showResult.challenger_partner ? ` & ${showResult.challenger_partner.full_name}` : ''}
                      <small> (bên thách đấu)</small>
                    </button>
                    <button onClick={() => handleSetWinner(showResult.id, 'opponent')}>
                      {showResult.opponent?.full_name}
                      {showResult.opponent_partner ? ` & ${showResult.opponent_partner.full_name}` : ''}
                      <small> (bên đối thủ)</small>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {loading ? <p className="muted">Đang tải...</p> : myMatches.length === 0 ? (
            <p className="muted">Chưa có kèo nào. Nhấn "+ Thách đấu mới" để bắt đầu!</p>
          ) : (
            <div className="pk-match-list">
              {myMatches.map((m) => {
                const iAmChallenger = m.challenger?.id === activePerson?.id || m.challenger_partner?.id === activePerson?.id
                const mySide = iAmChallenger ? m.challenger : m.opponent
                const theirSide = iAmChallenger ? m.opponent : m.challenger
                const myPartner = iAmChallenger ? m.challenger_partner : m.opponent_partner
                const theirPartner = iAmChallenger ? m.opponent_partner : m.challenger_partner
                const iWon = m.winner_side && ((iAmChallenger && m.winner_side === 'challenger') || (!iAmChallenger && m.winner_side === 'opponent'))

                return (
                  <div key={m.id} className={`pk-match-card${m.status === 'completed' ? (iWon ? ' pk-won' : ' pk-lost') : ''}`}>
                    <div className="pk-match-header">
                      <span className={`pk-badge pk-badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
                      <span className="pk-badge pk-badge-type">{m.match_type === 'singles' ? 'Đơn' : 'Đôi'}</span>
                      {m.played_at && <small className="muted">{formatDate(m.played_at)}</small>}
                    </div>

                    <div className="pk-match-vs">
                      <div className="pk-team">
                        <strong>{mySide?.full_name || 'Tôi'}</strong>
                        {myPartner && <small>& {myPartner.full_name}</small>}
                        <span className="muted">Bên tôi</span>
                      </div>
                      <span className="pk-vs">VS</span>
                      <div className="pk-team">
                        <strong>{theirSide?.full_name || '?'}</strong>
                        {theirPartner && <small>& {theirPartner.full_name}</small>}
                        <span className="muted">Đối thủ</span>
                      </div>
                    </div>

                    {m.bet_items && (
                      <p className="pk-bet">🎁 Cược: {m.bet_items}</p>
                    )}

                    {m.status === 'completed' && m.winner_side && (
                      <p className={`pk-result ${iWon ? 'pk-win-text' : 'pk-loss-text'}`}>
                        {iWon ? '🏆 Bạn đã thắng!' : '😔 Bạn đã thua'}
                      </p>
                    )}

                    {m.status === 'pending' && (
                      <div className="pk-match-actions">
                        <button onClick={() => setShowResult(m)}>Ghi kết quả</button>
                        <button className="danger" onClick={() => handleCancel(m.id)}>Hủy kèo</button>
                      </div>
                    )}
                  </div>
                )
              })}
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
                    : <span className="avatar large pk-player-avatar">{initials(p.full_name)}</span>
                  }
                  <strong>{p.full_name}</strong>
                  {p.nickname && <small className="muted">"{p.nickname}"</small>}
                  {p.phone && <small className="muted">{p.phone}</small>}
                  {p.gender && <small className="muted">{p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : 'Khác'}</small>}
                  {p.bio && <p className="pk-player-bio">{p.bio}</p>}
                  {p.id !== activePerson?.id && (
                    <button
                      className="pk-challenge-btn"
                      onClick={() => {
                        setForm((f) => ({ ...f, opponent_id: p.id }))
                        setTab('matches')
                        setShowCreate(true)
                      }}
                    >
                      Thách đấu
                    </button>
                  )}
                  {p.id === activePerson?.id && <span className="muted pk-you-tag">Bạn</span>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
