import { useState, useEffect } from 'react'
import { generateSchedule, appearanceStats } from './pk/scheduleUtils'
import { todayStr, buildRankMap, pairSingles, pairDoubles } from './pk/matchmakerUtils'
import { PlayerSlot } from './pk/PlayerSlot'
import { BatchMatchCard } from './pk/BatchMatchCard'
import { PersonPicker } from './pk/PersonPicker'

/* ── Main component ── */
export function RandomMatchmaker({ people, leaderboard, onClose, onCreate, onCreateBatch, lockedPerson }) {
  const [mode, setMode] = useState('singles')
  const [phase, setPhase] = useState('config')
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState([])
  const [count, setCount] = useState(1)
  const [playedAt, setPlayedAt] = useState(todayStr())
  const [batch, setBatch] = useState([])
  const [revealIdx, setRevealIdx] = useState(0)
  const [creating, setCreating] = useState(false)

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
    // Batch mode: ghép nhiều trận, tung xúc xắc lần lượt từng trận
    if (count > 1) {
      const pool = isUserMode ? [lockedPerson, ...selected] : selected
      const list = generateSchedule(pool, count, mode, rankMap)
      setBatch(list)
      setRevealIdx(0)
      setPhase('batch-spin')
      return
    }
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
    setBatch([])
  }

  function rerollBatch() {
    const pool = isUserMode ? [lockedPerson, ...selected] : selected
    setBatch(generateSchedule(pool, count, mode, rankMap))
    setRevealIdx(0)
    setPhase('batch-spin')
  }

  function skipReveal() {
    setRevealIdx(batch.length)
    setPhase('batch')
  }

  function removeBatchItem(idx) {
    setBatch((prev) => prev.filter((_, i) => i !== idx))
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

  async function handleCreateBatch() {
    if (!batch.length || creating) return
    setCreating(true)
    try {
      const payload = batch.map((m) => ({
        match_type: m.match_type,
        challenger_id: m.challenger?.id,
        opponent_id: m.opponent?.id,
        challenger_partner_id: m.challenger_partner?.id || '',
        opponent_partner_id: m.opponent_partner?.id || '',
        played_at: playedAt,
      }))
      await onCreateBatch(payload)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  // Reveal lần lượt từng trận trong batch (tung xúc xắc rồi chốt)
  useEffect(() => {
    if (phase !== 'batch-spin') return undefined
    if (revealIdx >= batch.length) {
      const t = setTimeout(() => setPhase('batch'), 450)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setRevealIdx((i) => i + 1), 1100)
    return () => clearTimeout(t)
  }, [phase, revealIdx, batch.length])

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

              {/* Số trận + ngày (batch) */}
              <div className="rm-count-row">
                <div className="rm-count-block">
                  <span className="rm-count-label">🗓️ Số trận muốn tạo</span>
                  <div className="rm-count-stepper">
                    <button type="button" className="rm-count-btn" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                    <input
                      type="number" min={1} max={30} value={count}
                      className="rm-count-input"
                      onChange={(e) => setCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                    />
                    <button type="button" className="rm-count-btn" onClick={() => setCount((c) => Math.min(30, c + 1))}>+</button>
                  </div>
                </div>
                {count > 1 && (
                  <div className="rm-count-block">
                    <span className="rm-count-label">📅 Ngày đấu</span>
                    <input
                      type="date" value={playedAt}
                      className="rm-date-input-mm"
                      onChange={(e) => setPlayedAt(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {count > 1 && (
                <p className="rm-count-hint muted">
                  Hệ thống chia đều số trận cho mọi người trong pool · {mode === 'doubles' ? 'hạn chế lặp cặp đồng đội' : 'ghép cân sức theo hạng'}
                </p>
              )}

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
                  {count > 1 ? `🗓️ Xếp lịch ${count} trận` : '🎲 Tung xúc xắc!'}
                </button>
              )}
            </>
          )}

          {/* ── BATCH SPIN (reveal lần lượt) ── */}
          {phase === 'batch-spin' && (
            <div className="rm-batch">
              <div className="rm-batch-progress">
                <span className="rm-spin-label">🎲 Đang xếp trận {Math.min(revealIdx + 1, batch.length)}/{batch.length}...</span>
                <button className="rm-skip-btn" onClick={skipReveal}>Bỏ qua ⏭</button>
              </div>

              {/* Trận đang quay */}
              {revealIdx < batch.length && (
                <div className="rm-arena rm-arena-compact">
                  <div className="rm-slots-row">
                    <div className="rm-team-slots">
                      <PlayerSlot person={null} spinning spinPool={spinPool} />
                      {mode === 'doubles' && <PlayerSlot person={null} spinning spinPool={spinPool} />}
                    </div>
                    <div className="rm-vs-divider"><span className="rm-vs-anim">VS</span></div>
                    <div className="rm-team-slots">
                      <PlayerSlot person={null} spinning spinPool={spinPool} />
                      {mode === 'doubles' && <PlayerSlot person={null} spinning spinPool={spinPool} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Các trận đã chốt */}
              <div className="rm-batch-list">
                {batch.slice(0, revealIdx).map((m, idx) => (
                  <div key={idx} className="rm-reveal-in">
                    <BatchMatchCard match={m} index={idx} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BATCH RESULT ── */}
          {phase === 'batch' && (
            <div className="rm-batch">
              <div className="rm-result-banner">🗓️ Lịch {batch.length} trận · {new Date(playedAt).toLocaleDateString('vi-VN')}</div>

              {batch.length === 0 ? (
                <p className="rm-error">Không ghép được trận nào. Hãy chọn thêm người vào pool.</p>
              ) : (
                <>
                  {/* Thống kê cân bằng */}
                  <div className="rm-batch-stats">
                    <span className="rm-batch-stats-title">Số trận mỗi người</span>
                    <div className="rm-batch-stats-list">
                      {appearanceStats(batch).map(({ person, count: c }) => (
                        <span key={person.id} className="rm-batch-stat-chip">
                          {person.full_name?.split(' ').slice(-1)[0] || person.full_name}
                          <b>{c}</b>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Danh sách trận */}
                  <div className="rm-batch-list">
                    {batch.map((m, idx) => (
                      <BatchMatchCard key={idx} match={m} index={idx} onRemove={() => removeBatchItem(idx)} />
                    ))}
                  </div>
                </>
              )}

              <div className="rm-result-actions">
                <button className="rm-reroll-btn" onClick={rerollBatch}>🔄 Xếp lại</button>
                <button className="rm-create-btn" onClick={handleCreateBatch} disabled={creating || batch.length === 0}>
                  {creating ? 'Đang tạo...' : `⚡ Tạo ${batch.length} kèo`}
                </button>
              </div>
              <button className="rm-back-link" onClick={reroll}>← Chỉnh lại pool</button>
            </div>
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
