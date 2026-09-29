import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, List, Feather } from 'lucide-react'
import { formatDate } from '../utils/appUtils'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function SessionCard({ session, onEdit, onDelete, onViewGuests }) {
  const date = session.play_date?.slice(0, 10) || ''
  return <article className="sc-card">
    <div className="sc-date-badge" aria-hidden="true"><strong>{date.slice(8)}</strong><span>TH {date.slice(5, 7)}</span></div>
    <div className="sc-card-body">
      <h3>{formatDate(date)}</h3>
      <p className="sc-card-note">{session.note || 'Buổi đánh đã được ghi nhận'}</p>
      <span className="sc-shuttle-chip"><Feather size={14} aria-hidden="true" /> {Number(session.shuttle_used_count || 0)} quả cầu đã dùng</span>
      {(onEdit || onDelete || onViewGuests) && <div className="sc-card-actions">
        {onViewGuests && <button type="button" onClick={() => onViewGuests(session)}>Xem khách</button>}
        {onEdit && <button type="button" onClick={() => onEdit(session)}>Chỉnh sửa</button>}
        {onDelete && <button type="button" className="sc-danger" onClick={() => onDelete(session)}>Xóa buổi</button>}
      </div>}
    </div>
  </article>
}

export function SessionCalendar({ sessions = [], onEdit, onDelete, onViewGuests }) {
  const [view, setView] = useState('list')
  // Follow asynchronously loaded sessions until the user selects a month.
  const [chosenMonth, setChosenMonth] = useState(null)
  const [selected, setSelected] = useState(null)
  const sorted = useMemo(() => [...sessions].sort((a, b) => (b.play_date || '').localeCompare(a.play_date || '')), [sessions])
  const now = new Date()
  const monthKey = chosenMonth || sorted[0]?.play_date?.slice(0, 7) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, monthNumber] = monthKey.split('-').map(Number)
  const month = monthNumber - 1
  const monthSessions = sorted.filter((s) => s.play_date?.startsWith(monthKey))
  const map = new Map()
  monthSessions.forEach((s) => {
    const date = s.play_date.slice(0, 10)
    map.set(date, [...(map.get(date) || []), s])
  })
  const count = new Date(year, month + 1, 0).getDate()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i >= offset && i < offset + count ? i - offset + 1 : null)
  const totalShuttles = monthSessions.reduce((sum, s) => sum + Number(s.shuttle_used_count || 0), 0)
  const rows = view === 'calendar' && selected ? map.get(selected) || [] : monthSessions
  function moveMonth(delta) {
    const date = new Date(year, month + delta, 1)
    setChosenMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    setSelected(null)
  }
  return <div className="sc-root">
    <div className="sc-toolbar">
      <div className="sc-cal-header">
        <button type="button" aria-label="Tháng trước" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button>
        <h3>Tháng {monthNumber} <span>{year}</span></h3>
        <button type="button" aria-label="Tháng sau" onClick={() => moveMonth(1)}><ChevronRight size={20} /></button>
      </div>
      <div className="sc-view-switch" aria-label="Cách xem buổi đánh">
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} />Danh sách</button>
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays size={16} />Lịch tháng</button>
      </div>
    </div>
    <div className="sc-summary"><span><strong>{monthSessions.length}</strong> buổi trong tháng</span><span><strong>{totalShuttles}</strong> quả cầu đã dùng</span></div>
    {view === 'calendar' && <div className="sc-calendar">
      <div className="sc-dow-row">{DAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="sc-grid">{cells.map((day, i) => {
        if (!day) return <span key={i} />
        const date = `${monthKey}-${String(day).padStart(2, '0')}`
        const amount = map.get(date)?.length || 0
        return <button key={date} type="button" className={`sc-cell${amount ? ' sc-has-session' : ''}`}
          disabled={!amount} aria-pressed={selected === date} aria-label={`${formatDate(date)}, ${amount} buổi`}
          onClick={() => setSelected(selected === date ? null : date)}>
          <span>{day}</span>{amount > 0 && <small>{amount} buổi</small>}
        </button>
      })}</div>
      <p className="sc-hint">Chạm ngày có buổi đánh để xem chi tiết.</p>
    </div>}
    <div className="sc-list-heading"><h4>{selected && view === 'calendar' ? `Ngày ${formatDate(selected)}` : 'Các buổi đã ghi nhận'}</h4>
      {selected && view === 'calendar' && <button type="button" onClick={() => setSelected(null)}>Xem cả tháng</button>}
    </div>
    {rows.length ? <div className="sc-session-list">{rows.map((session) => <SessionCard key={session.id} session={session} onEdit={onEdit} onDelete={onDelete} onViewGuests={onViewGuests} />)}</div>
      : <div className="sc-empty"><CalendarDays size={32} aria-hidden="true" /><h4>Chưa có buổi đánh</h4><p>{sessions.length ? 'Thử chọn tháng khác để xem các buổi đã ghi nhận.' : 'Các buổi đánh sẽ xuất hiện ở đây khi CLB ghi nhận.'}</p></div>}
  </div>
}
