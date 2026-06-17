import { useState, useEffect, useRef } from 'react'
import { initials } from '../../utils/appUtils'

/* ── helpers ── */
function getRankedPool(people, leaderboard) {
  const rankMap = {}
  leaderboard.forEach((lb) => { rankMap[lb.id] = lb.rank || 999 })
  return [...people].sort((a, b) => (rankMap[a.id] || 999) - (rankMap[b.id] || 999))
}

function balancedSingles(ranked) {
  if (ranked.length < 2) return null
  const mid = Math.ceil(ranked.length / 2)
  const top = ranked.slice(0, mid)
  const bot = ranked.slice(mid)
  const c = top[Math.floor(Math.random() * top.length)]
  const o = bot[Math.floor(Math.random() * bot.length)]
  return { match_type: 'singles', challenger: c, opponent: o, challenger_partner: null, opponent_partner: null }
}

function balancedDoubles(ranked) {
  if (ranked.length < 4) return null
  const pool = ranked.slice(0, Math.min(ranked.length, 8))
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 4)
  const rankIdx = {}
  ranked.forEach((p, i) => { rankIdx[p.id] = i })
  shuffled.sort((a, b) => (rankIdx[a.id] ?? 99) - (rankIdx[b.id] ?? 99))
  const [r1, r2, r3, r4] = shuffled
  if (Math.random() > 0.5) {
    return { match_type: 'doubles', challenger: r1, challenger_partner: r4, opponent: r2, opponent_partner: r3 }
  }
  return { match_type: 'doubles', challenger: r2, challenger_partner: r3, opponent: r1, opponent_partner: r4 }
}

function PlayerSlot({ person, spinning, spinPool }) {
  const [display, setDisplay] = useState(person)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (spinning && spinPool.length > 0) {
      let i = 0
      intervalRef.current = setInterval(() => {
        setDisplay(spinPool[i % spinPool.length])
        i++
      }, 80)
    } else {
      clearInterval(intervalRef.current)
      if (person) setDisplay(person)
    }
    return () => clearInterval(intervalRef.current)
  }, [spinning, person])

  return (
    <div className={`rm-slot${spinning ? ' rm-spinning' : ' rm-landed'}`}>
      {display?.avatar_url
        ? <img src={display.avatar_url} alt={display?.full_name} className="rm-slot-avatar avatar-img" />
        : <div className="rm-slot-avatar rm-avatar-initials">{initials(display?.full_name || '?')}</div>}
      <span className="rm-slot-name">{display?.full_name || '?'}</span>
    </div>
  )
}

/* ── main component ── */
export function RandomMatchmaker({ people, leaderboard, onClose, onCreate }) {
  const [mode, setMode] = useState('singles')
  const [phase, setPhase] = useState('config')   // config | spinning | result
  const [result, setResult] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const ranked = getRankedPool(people, leaderboard)

  function spin() {
    setPhase('spinning')
    setSpinning(true)

    setTimeout(() => {
      const r = mode === 'singles' ? balancedSingles(ranked) : balancedDoubles(ranked)
      setResult(r)
      setSpinning(false)
      setTimeout(() => setPhase('result'), 300)
    }, 2200)
  }

  function reroll() {
    setPhase('config')
    setResult(null)
  }

  function handleCreate() {
    if (!result) return
    onCreate({
      match_type: result.match_type,
      challenger_id: result.challenger?.id,
      opponent_id: result.opponent?.id,
      challenger_partner_id: result.challenger_partner?.id || '',
      opponent_partner_id: result.opponent_partner?.id || '',
    })
    onClose()
  }

  const insufficientPlayers = mode === 'singles' ? ranked.length < 2 : ranked.length < 4

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal rm-modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>

        {/* hero banner */}
        <div className="rm-hero" style={{ backgroundImage: 'url(/images/player-spotlight.jpg)' }}>
          <div className="rm-hero-overlay" />
          <div className="rm-hero-content">
            <div className="rm-dice">🎲</div>
            <h2 className="rm-title">Ghép Đội Ngẫu Nhiên</h2>
            <p className="rm-subtitle">Hệ thống ghép đội cân bằng theo xếp hạng</p>
          </div>
        </div>

        <div className="rm-body">
          {/* ── CONFIG ── */}
          {phase === 'config' && (
            <>
              <div className="rm-mode-picker">
                <button
                  className={`rm-mode-btn${mode === 'singles' ? ' active' : ''}`}
                  onClick={() => setMode('singles')}
                >
                  <span className="rm-mode-icon">⚔️</span>
                  <strong>Đánh Đơn</strong>
                  <small>2 người · 1 vs 1</small>
                </button>
                <button
                  className={`rm-mode-btn${mode === 'doubles' ? ' active' : ''}`}
                  onClick={() => setMode('doubles')}
                >
                  <span className="rm-mode-icon">🤝</span>
                  <strong>Đánh Đôi</strong>
                  <small>4 người · 2 vs 2</small>
                </button>
              </div>

              <div className="rm-balance-info">
                <div className="rm-info-row">
                  <span className="rm-info-icon">🏆</span>
                  <div>
                    <strong>Cân bằng theo xếp hạng</strong>
                    <p className="muted">
                      {mode === 'singles'
                        ? 'Người xếp hạng cao ghép với người xếp hạng thấp'
                        : 'Mỗi đội có 1 người mạnh + 1 người yếu'}
                    </p>
                  </div>
                </div>
                <div className="rm-info-row">
                  <span className="rm-info-icon">👥</span>
                  <div>
                    <strong>{ranked.length} người trong pool</strong>
                    <p className="muted">Cần tối thiểu {mode === 'singles' ? 2 : 4} người</p>
                  </div>
                </div>
              </div>

              {insufficientPlayers ? (
                <p className="rm-error">Không đủ người chơi để ghép {mode === 'singles' ? 'đơn' : 'đôi'}</p>
              ) : (
                <button className="rm-spin-btn" onClick={spin}>
                  🎲 Tung xúc xắc!
                </button>
              )}
            </>
          )}

          {/* ── SPINNING ── */}
          {phase === 'spinning' && (
            <div className="rm-arena">
              <p className="rm-spin-label">Đang tìm đối thủ xứng tầm...</p>
              <div className="rm-slots-row">
                <div className="rm-team-slots">
                  <span className="rm-team-tag">Đội A</span>
                  <PlayerSlot person={null} spinning spinPool={ranked} />
                  {mode === 'doubles' && <PlayerSlot person={null} spinning spinPool={ranked} />}
                </div>
                <div className="rm-vs-divider">
                  <span className="rm-vs-anim">VS</span>
                </div>
                <div className="rm-team-slots">
                  <span className="rm-team-tag">Đội B</span>
                  <PlayerSlot person={null} spinning spinPool={ranked} />
                  {mode === 'doubles' && <PlayerSlot person={null} spinning spinPool={ranked} />}
                </div>
              </div>
            </div>
          )}

          {/* ── RESULT ── */}
          {phase === 'result' && result && (
            <div className="rm-result">
              <div className="rm-result-banner">✨ Kèo đấu đã được tạo!</div>

              <div className="rm-result-card">
                <div className="rm-result-team">
                  <span className="rm-result-team-label">Thách đấu</span>
                  <PlayerSlot person={result.challenger} spinning={false} spinPool={[]} />
                  {result.challenger_partner && (
                    <PlayerSlot person={result.challenger_partner} spinning={false} spinPool={[]} />
                  )}
                </div>

                <div className="rm-result-vs">
                  <span className="rm-vs-big">VS</span>
                  <span className="rm-match-type-tag">
                    {result.match_type === 'singles' ? '⚔ Đơn' : '🤝 Đôi'}
                  </span>
                </div>

                <div className="rm-result-team">
                  <span className="rm-result-team-label">Đối thủ</span>
                  <PlayerSlot person={result.opponent} spinning={false} spinPool={[]} />
                  {result.opponent_partner && (
                    <PlayerSlot person={result.opponent_partner} spinning={false} spinPool={[]} />
                  )}
                </div>
              </div>

              <div className="rm-result-actions">
                <button className="rm-reroll-btn" onClick={reroll}>🔄 Tung lại</button>
                <button className="rm-create-btn" onClick={handleCreate}>⚡ Tạo kèo ngay</button>
              </div>
            </div>
          )}

          <button className="rm-close-btn" onClick={onClose}>Đóng</button>
        </div>
      </section>
    </div>
  )
}
