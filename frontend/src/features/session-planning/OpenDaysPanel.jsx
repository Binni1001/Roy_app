import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Panel } from '../../components/common'
import { formatPlanningDate } from './planningUtils'
import './sessionPlanning.css'

export default function OpenDaysPanel({ periodId }) {
  // Remount the workspace on scope change; pending responses cannot affect another CLB/kỳ.
  return <Panel title="Buổi tự đăng ký">
    {periodId ? <OpenDaysWorkspace key={periodId} periodId={periodId} /> : <p>Chọn một kỳ để xem các ngày mở đăng ký.</p>}
  </Panel>
}

function OpenDaysWorkspace({ periodId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const mounted = useRef(false)
  const lock = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    api.sessionPlanning.openDays(periodId).then(value => {
      if (active) { setData(value); setError('') }
    }).catch(err => { if (active) setError(err.message || 'Không thể tải các ngày đăng ký.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [periodId, reload])
  async function change(playDate, action) {
    if (lock.current) return
    lock.current = true
    setPending(`${playDate}:${action}`); setError(''); setMessage('')
    try {
      await api.sessionPlanning.changeOpenDay(periodId, playDate, { action, ...(action === 'open' ? { note } : {}) })
      if (!mounted.current) return
      setMessage({ open: 'Ngày đã có trong danh sách đăng ký.', close: 'Đã đóng đăng ký. Danh sách người chơi được giữ nguyên.', reopen: 'Đã mở lại đăng ký.', join: 'Đã giữ chỗ cho bạn!', leave: 'Đã hủy đăng ký của bạn.' }[action])
      if (action === 'open') { setDate(''); setNote('') }
      // Keep write controls locked until the authoritative roster is refreshed.
      const fresh = await api.sessionPlanning.openDays(periodId)
      if (mounted.current) setData(fresh)
    } catch (err) {
      if (mounted.current) setError(err.message || 'Không thể xử lý. Hãy làm mới rồi thử lại.')
    } finally {
      lock.current = false
      if (mounted.current) setPending('')
    }
  }
  return <div className="session-planning open-days">
    <p className="planning-note">Admin chọn ngày mở. Thành viên trong CLB tự đăng ký, tối đa 8 người/buổi; ai đăng ký trước giữ chỗ trước.</p>
    <div className="planning-facts"><span>17:30–19:30</span><span>Hủy trước 17:30 ngày chơi</span><span>Tách khỏi 4 buổi cố định</span></div>
    <div className="planning-toolbar"><button type="button" disabled={loading || Boolean(pending)} onClick={() => { setLoading(true); setReload(n => n + 1) }}>Làm mới chỗ trống</button></div>
    {loading && <p role="status">Đang tải ngày đăng ký…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p className="planning-notice" role="status">{message}</p>}
    {data && <>
      {!data.can_edit && <p>Kỳ này chưa mở hoặc đã đóng. Bạn chỉ có thể xem danh sách.</p>}
      {data.can_manage && <details className="planning-help"><summary>+ Mở ngày tự đăng ký</summary>
        <form className="planning-editor" onSubmit={event => { event.preventDefault(); change(date, 'open') }}>
          <fieldset disabled={!data.can_edit || Boolean(pending) || loading}>
            <legend>Chọn ngày chơi</legend>
            <label>Ngày mở đăng ký<input type="date" required value={date} min={data.period.start_date} max={data.period.end_date} onChange={event => setDate(event.target.value)} /></label>
            <label>Lời nhắn cho người chơi<input value={note} maxLength={300} placeholder="Ví dụ: Giao lưu nhẹ nhàng, mang theo nước nhé" onChange={event => setNote(event.target.value)} /></label>
            <p className="planning-note">Có thể chọn bất kỳ ngày nào trong kỳ đang mở, kể cả thứ Năm. Chọn trước 17:30 ngày chơi.</p>
            <button type="submit">{pending.endsWith(':open') ? 'Đang mở…' : 'Mở đăng ký · 8 chỗ'}</button>
          </fieldset>
        </form>
      </details>}
      {!data.days.length && <div className="open-day-empty">Chưa có ngày mở đăng ký. {data.can_manage ? 'Chọn “Mở ngày tự đăng ký” để bắt đầu.' : 'Các ngày admin mở sẽ xuất hiện tại đây.'}</div>}
      <div className="open-day-list">{data.days.map(day => <article className={`open-day-card${day.joined ? ' is-joined' : ''}`} key={day.play_date}>
        <div className="open-day-heading"><h3>{formatPlanningDate(day.play_date)}</h3><span>{day.started ? 'Đã đến giờ chơi' : day.status === 'closed' ? 'Đã đóng đăng ký' : `${Math.max(0, day.capacity - day.count)} chỗ trống`}</span></div>
        <p className="planning-note">17:30–19:30 · {day.count}/{day.capacity} người đã đăng ký</p>
        {day.note && <p className="open-day-note">{day.note}</p>}
        {day.joined && <p className="open-day-joined">✓ Bạn đã đăng ký buổi này</p>}
        <div className="open-day-actions">
          {day.can_join && <button className="planning-primary" disabled={Boolean(pending) || loading} onClick={() => change(day.play_date, 'join')}>Đăng ký tham gia</button>}
          {day.can_leave && <button disabled={Boolean(pending) || loading} onClick={() => change(day.play_date, 'leave')}>Hủy đăng ký của tôi</button>}
          {day.can_change && <button disabled={Boolean(pending) || loading} onClick={() => change(day.play_date, day.status === 'open' ? 'close' : 'reopen')}>{day.status === 'open' ? 'Đóng đăng ký' : 'Mở lại đăng ký'}</button>}
        </div>
        {data.can_manage && <details className="planning-help"><summary>Người đã đăng ký ({day.count})</summary>{day.names.length ? <ul>{day.names.map((name, i) => <li key={i}>{name}</li>)}</ul> : <p>Chưa có người đăng ký.</p>}</details>}
      </article>)}</div>
    </>}
    <p className="planning-note">Đăng ký chỉ giữ chỗ. Công nợ được xử lý theo quy trình ghi nhận buổi đánh của CLB.</p>
  </div>
}
