import { useState, useMemo } from 'react'
import { formatDate } from '../utils/appUtils'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

function getCalendarCells(year, month) {
  // month is 0-indexed
  const firstDow = new Date(year, month, 1).getDay()        // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1     // shift to Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toDateStr(year, month, day) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function isToday(year, month, day) {
  const t = new Date()
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
}

/* ── SessionCard ── */
function SessionCard({ session, onEdit, onDelete, onViewGuests }) {
  const shuttles = session.shuttle_used_count || 0
  return (
    <div className="sc-card">
      <div className="sc-card-left">
        <span className="sc-card-date">📅 {formatDate(session.play_date)}</span>
        {session.note && <span className="sc-card-note muted">{session.note}</span>}
      </div>
      <div className="sc-card-right">
        {shuttles > 0 && (
          <span className="sc-shuttle-chip">🏸 {shuttles} quả</span>
        )}
        {(onEdit || onDelete || onViewGuests) && (
          <div className="sc-card-actions">
            {onViewGuests && <button className="sc-btn" onClick={() => onViewGuests(session)}>Khách</button>}
            {onEdit      && <button className="sc-btn" onClick={() => onEdit(session)}>Sửa</button>}
            {onDelete    && <button className="sc-btn sc-btn-danger" onClick={() => onDelete(session)}>Xóa</button>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Calendar ── */
export function SessionCalendar({ sessions = [], onEdit, onDelete, onViewGuests }) {
  // Default to the month of the latest session, or current month
  const defaultDate = useMemo(() => {
    if (sessions.length > 0) {
      const latest = [...sessions].sort((a, b) => new Date(b.play_date) - new Date(a.play_date))[0]
      const d = new Date(latest.play_date)
      return { year: d.getFullYear(), month: d.getMonth() }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  }, [sessions])

  const [year, setYear]   = useState(defaultDate.year)
  const [month, setMonth] = useState(defaultDate.month)
  const [selected, setSelected] = useState(null)

  const cells = getCalendarCells(year, month)

  // Build session map: dateStr → session[]
  const sessionMap = useMemo(() => {
    const map = {}
    sessions.forEach((s) => {
      const key = s.play_date?.slice(0, 10)
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(s)
    })
    return map
  }, [sessions])

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelected(null)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelected(null)
  }

  const selectedSessions = selected ? (sessionMap[selected] || []) : []
  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.play_date)
    return d.getFullYear() === year && d.getMonth() === month
  }).sort((a, b) => new Date(b.play_date) - new Date(a.play_date))

  const totalShuttles = monthSessions.reduce((s, e) => s + Number(e.shuttle_used_count || 0), 0)

  return (
    <div className="sc-root">
      {/* Stats strip */}
      <div className="sc-stats">
        <div className="sc-stat">
          <span className="sc-stat-num">{monthSessions.length}</span>
          <span className="sc-stat-lbl">Buổi</span>
        </div>
        <div className="sc-stat">
          <span className="sc-stat-num">{totalShuttles}</span>
          <span className="sc-stat-lbl">Quả cầu</span>
        </div>
        <div className="sc-stat">
          <span className="sc-stat-num">
            {monthSessions.length > 0 ? (totalShuttles / monthSessions.length).toFixed(1) : '—'}
          </span>
          <span className="sc-stat-lbl">Quả/buổi</span>
        </div>
      </div>

      {/* Calendar header */}
      <div className="sc-cal-header">
        <button className="sc-nav-btn" onClick={prev}>‹</button>
        <span className="sc-month-label">{MONTHS[month]} {year}</span>
        <button className="sc-nav-btn" onClick={next}>›</button>
      </div>

      {/* Day-of-week labels */}
      <div className="sc-dow-row">
        {DAYS.map((d) => <span key={d} className="sc-dow">{d}</span>)}
      </div>

      {/* Calendar grid */}
      <div className="sc-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="sc-cell sc-cell-empty" />
          const dateStr = toDateStr(year, month, day)
          const hasSessions = !!sessionMap[dateStr]
          const isSelected = selected === dateStr
          const today = isToday(year, month, day)
          return (
            <div
              key={i}
              className={`sc-cell${hasSessions ? ' sc-has-session' : ''}${isSelected ? ' sc-selected' : ''}${today ? ' sc-today' : ''}`}
              onClick={() => hasSessions && setSelected(isSelected ? null : dateStr)}
            >
              <span className="sc-day-num">{day}</span>
              {hasSessions && (
                <span className="sc-dot-count">{sessionMap[dateStr].length}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selected && selectedSessions.length > 0 && (
        <div className="sc-detail">
          <p className="sc-detail-title">📅 {formatDate(selected)}</p>
          {selectedSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewGuests={onViewGuests}
            />
          ))}
        </div>
      )}

      {/* Month session list */}
      <div className="sc-month-list">
        <p className="sc-list-title">Tất cả buổi trong tháng ({monthSessions.length})</p>
        {monthSessions.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.83rem' }}>Không có buổi nào trong tháng này.</p>
        ) : (
          monthSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewGuests={onViewGuests}
            />
          ))
        )}
      </div>
    </div>
  )
}
