import { useState, useEffect, useRef } from 'react'
import { initials } from '../../utils/appUtils'

/* ── Rank helpers ── */
function buildRankMap(leaderboard) {
  const map = {}
  leaderboard.forEach((lb) => { map[lb.id] = lb.rank || 999 })
  return map
}

function sortByRank(people, rankMap) {
  return [...people].sort((a, b) => (rankMap[a.id] || 500) - (rankMap[b.id] || 500))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Pairing algorithms ── */
// Singles: sort selected by rank → snake pairs (1 vs N, 2 vs N-1, ...) → pick one random pair
function pairSingles(selected, rankMap, lockedPerson) {
  const sorted = sortByRank(selected, rankMap)
  const n = sorted.length
  const pairs = []
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([sorted[i], sorted[n - 1 - i]])
  }
  const pair = pairs[Math.floor(Math.random() * pairs.length)]
  if (lockedPerson) {
    const other = pair[0].id === lockedPerson.id ? pair[1] : pair[0]
    return { match_type: 'singles', challenger: lockedPerson, opponent: other, challenger_partner: null, opponent_partner: null }
  }
  const [a, b] = Math.random() > 0.5 ? pair : [pair[1], pair[0]]
  return { match_type: 'singles', challenger: a, opponent: b, challenger_partner: null, opponent_partner: null }
}

// Doubles: pick 4 from selected (equal probability), sort by rank → r1+r4 vs r2+r3
function pairDoubles(selected, rankMap, lockedPerson) {
  let pool
  if (lockedPerson) {
    const others = shuffle(selected.filter((p) => p.id !== lockedPerson.id)).slice(0, 3)
    pool = [lockedPerson, ...others]
  } else {
    pool = shuffle(selected).slice(0, 4)
  }
  const sorted = sortByRank(pool, rankMap)
  const [r1, r2, r3, r4] = sorted

  if (lockedPerson) {
    // lockedPerson always challenger — pair them with weakest (r4)
    const selfIdx = sorted.findIndex((p) => p.id === lockedPerson.id)
    const rest = sorted.filter((p) => p.id !== lockedPerson.id) // r of others sorted
    // self + weakest of others vs 2 middle
    return {
      match_type: 'doubles',
      challenger: lockedPerson, challenger_partner: rest[2],
      opponent: rest[0], opponent_partner: rest[1],
    }
  }

  // Admin mode: randomly assign which pair is challenger
  if (Math.random() > 0.5) {
    return { match_type: 'doubles', challenger: r1, challenger_partner: r4, opponent: r2, opponent_partner: r3 }
  }
  return { match_type: 'doubles', challenger: r2, challenger_partner: r3, opponent: r1, opponent_partner: r4 }
}

/* ── PlayerSlot ── */
function PlayerSlot({ person, spinning, spinPool }) {
  const [display, setDisplay] = useState(person)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (spinning && spinPool.length > 0) {
      const pool = shuffle(spinPool)
      let i = 0
      intervalRef.current = setInterval(() => {
        setDisplay(pool[i % pool.length])
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

/* ── PersonPicker ── */
function PersonPicker({ people, selected, onToggle, onSelectAll, onClearAll, rankMap, lockedPerson }) {
  return (
    <div className="rm-picker">
      <div className="rm-picker-header">
        <span className="rm-picker-count">{selected.length + (lockedPerson ? 1 : 0)} người trong pool</span>
        <div className="rm-picker-actions">
          <button type="button" className="rm-picker-btn" onClick={onSelectAll}>Chọn tất cả</button>
          <button type="button" className="rm-picker-btn" onClick={onClearAll}>Bỏ chọn</button>
        </div>
      </div>
      <div className="rm-picker-list">
        {lockedPerson && (
          <div className="rm-picker-item rm-picker-locked">
            <div className="rm-picker-avatar">
              {lockedPerson.avatar_url
                ? <img src={lockedPerson.avatar_url} alt={lockedPerson.full_name} className="avatar-img" />
                : <span>{initials(lockedPerson.full_name)}</span>}
            </div>
            <span className="rm-picker-name">{lockedPerson.full_name}</span>
            {rankMap[lockedPerson.id] && rankMap[lockedPerson.id] < 999 && (
              <span className="rm-picker-rank">#{rankMap[lockedPerson.id]}</span>
            )}
            <span className="rm-picker-lock-tag">Bạn</span>
          </div>
        )}
        {people.map((p) => {
          const isSelected = selected.some((s) => s.id === p.id)
          const rank = rankMap[p.id]
          return (
            <label key={p.id} className={`rm-picker-item${isSelected ? ' rm-picker-checked' : ''}`}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(p)} />
              <div className="rm-picker-avatar">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt={p.full_name} className="avatar-img" />
                  : <span>{initials(p.full_name)}</span>}
              </div>
              <span className="rm-picker-name">{p.full_name}{p.nickname ? ` · ${p.nickname}` : ''}</span>
              {rank && rank < 999
                ? <span className="rm-picker-rank">#{rank}</span>
                : <span className="rm-picker-rank rm-picker-unranked">–</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main component ── */
export function RandomMatchmaker({ people, leaderboard, onClose, onCreate, lockedPerson }) {
  const [mode, setMode] = useState('singles')
  const [phase, setPhase] = useState('config')
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState([])

  const rankMap = buildRankMap(leaderboard || [])
  const isUserMode = !!lockedPerson

  // Exclude self from pickable list — self is always locked in
  const pickable = isUserMode ? people.filter((p) => p.id !== lockedPerson.id) : people

  const minNeeded = mode === 'singles'
    ? (isUserMode ? 1 : 2)
    : (isUserMode ? 3 : 4)

  const insufficient = selected.length < minNeeded

  function togglePerson(p) {
    setSelected((prev) =>
      prev.some((s) => s.id === p.id) ? prev.filter((s) => s.id !== p.id) : [...prev, p]
    )
  }

  function selectAll() { setSelected(pickable) }
  function clearAll()  { setSelected([]) }

  // Full pool for spin animation = selected + lockedPerson if user mode
  const spinPool = isUserMode ? [lockedPerson, ...selected] : selected

  function spin() {
    setPhase('spinning')
    setTimeout(() => {
      const pool = isUserMode ? [lockedPerson, ...selected] : selected
      const r = mode === 'singles'
        ? pairSingles(pool, rankMap, lockedPerson)
        : pairDoubles(pool, rankMap, lockedPerson)
      setResult(r)
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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal rm-modal" role="dialog" onMouseDown={(e) => e.stopPropagation()}>

        {/* Hero */}
        <div className="rm-hero" style={{ backgroundImage: 'url(/images/player-spotlight.jpg)' }}>
          <div className="rm-hero-overlay" />
          <div className="rm-hero-content">
            <div className="rm-dice">🎲</div>
            <h2 className="rm-title">Ghép Đội Ngẫu Nhiên</h2>
            <p className="rm-subtitle">Chọn người vào pool → hệ thống ghép cặp cân bằng</p>
          </div>
        </div>

        <div className="rm-body">

          {/* ── CONFIG ── */}
          {phase === 'config' && (
            <>
              {/* Mode picker */}
              <div className="rm-mode-picker">
                <button className={`rm-mode-btn${mode === 'singles' ? ' active' : ''}`} onClick={() => setMode('singles')}>
                  <span className="rm-mode-icon">⚔️</span>
                  <strong>Đánh Đơn</strong>
                  <small>1 vs 1</small>
                </button>
                <button className={`rm-mode-btn${mode === 'doubles' ? ' active' : ''}`} onClick={() => setMode('doubles')}>
                  <span className="rm-mode-icon">🤝</span>
                  <strong>Đánh Đôi</strong>
                  <small>2 vs 2</small>
                </button>
              </div>

              {/* Pairing rule info */}
              <div className="rm-balance-info">
                {isUserMode && (
                  <div className="rm-info-row rm-info-self">
                    <span className="rm-info-icon">👤</span>
                    <div>
                      <strong>Bạn luôn có mặt</strong>
                      <p className="muted">{lockedPerson?.full_name} · bên thách đấu</p>
                    </div>
                  </div>
                )}
                <div className="rm-info-row">
                  <span className="rm-info-icon">🏆</span>
                  <div>
                    <strong>{mode === 'singles' ? 'Ghép snake: top vs bottom' : 'Ghép đôi: r1+r4 vs r2+r3'}</strong>
                    <p className="muted">
                      {mode === 'singles'
                        ? 'Xếp hạng 1 gặp xếp hạng cuối, 2 gặp áp chót... random chọn 1 cặp'
                        : 'Mạnh nhất + Yếu nhất vs 2 người giữa — tổng sức cân bằng'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Player picker */}
              <PersonPicker
                people={pickable}
                selected={selected}
                onToggle={togglePerson}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                rankMap={rankMap}
                lockedPerson={isUserMode ? lockedPerson : null}
              />

              {insufficient ? (
                <p className="rm-error">
                  Cần chọn thêm {minNeeded - selected.length} người nữa để ghép {mode === 'singles' ? 'đơn' : 'đôi'}
                </p>
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
                  <PlayerSlot person={isUserMode ? lockedPerson : null} spinning={!isUserMode} spinPool={spinPool} />
                  {mode === 'doubles' && <PlayerSlot person={null} spinning spinPool={spinPool} />}
                </div>
                <div className="rm-vs-divider">
                  <span className="rm-vs-anim">VS</span>
                </div>
                <div className="rm-team-slots">
                  <span className="rm-team-tag">Đội B</span>
                  <PlayerSlot person={null} spinning spinPool={spinPool} />
                  {mode === 'doubles' && <PlayerSlot person={null} spinning spinPool={spinPool} />}
                </div>
              </div>
            </div>
          )}

          {/* ── RESULT ── */}
          {phase === 'result' && result && (
            <div className="rm-result">
              <div className="rm-result-banner">✨ Cặp đấu đã được chọn!</div>

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
                  <span className="rm-match-type-tag">{result.match_type === 'singles' ? '⚔ Đơn' : '🤝 Đôi'}</span>
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
