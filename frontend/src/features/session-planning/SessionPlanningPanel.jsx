import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Panel } from '../../components/common'
import { errorText } from '../../utils/appUtils'
import { formatPlanningDate as formatDate, preferencePayload, WEEKDAYS, weekStartFor } from './planningUtils'
import DraftPlanningPanel from './DraftPlanningPanel'
import './sessionPlanning.css'

export default function SessionPlanningPanel({ periodId, manager = false }) {
  const [opened, setOpened] = useState(false)
  return <Panel title={manager ? 'Chuẩn bị lịch chơi' : 'Bạn bận ngày nào?'} action={
    <button type="button" aria-expanded={opened} disabled={!periodId} onClick={() => setOpened((value) => !value)}>
      {opened ? 'Thu gọn' : manager ? 'Xem lịch bận & xếp thử' : 'Chọn ngày bận'}
    </button>
  }>
    <div className="planning-intro">
      <p>{manager ? 'Xem ngày rảnh của thành viên và thử sắp xếp một tuần chơi phù hợp.' : 'Cho CLB biết ngày bạn không đi được để sắp xếp lịch phù hợp hơn.'}</p>
      <div className="planning-facts"><span>17:30–19:30</span><span>Nghỉ thứ Năm</span><span>4 buổi / tuần</span>{manager && <span>Tối đa 8 người / buổi</span>}</div>
      <p className="planning-note">Đây là lịch bận để chuẩn bị, chưa phải đăng ký tham gia buổi đánh.</p>
      <details className="planning-help"><summary>Thông tin thêm</summary><p>Chưa công bố lịch, giữ chỗ, gửi thông báo hoặc tạo công nợ.</p></details>
    </div>
    {!periodId && <p>Chọn một kỳ để khai báo lịch bận.</p>}
    {opened && periodId && <PlanningWorkspace key={periodId} periodId={periodId} />}
  </Panel>
}

function PlanningWorkspace({ periodId }) {
  const [weekStart, setWeekStart] = useState('')
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const requestKey = `${periodId}:${weekStart}:${reload}`

  useEffect(() => {
    let active = true
    api.sessionPlanning.get(periodId, weekStart || undefined).then(
      (data) => { if (active) setResult({ key: requestKey, data }) },
      (error) => { if (active) setResult({ key: requestKey, error: errorText(error) }) },
    )
    return () => { active = false }
  }, [periodId, weekStart, requestKey])

  // Never render the previous period/week while the new request is loading.
  if (result?.key !== requestKey) return <p role="status">Đang kiểm tra lịch bận…</p>
  if (result.error) return <div role="alert">
    <p>{result.error}</p>
    <button type="button" onClick={() => setReload((value) => value + 1)}>Thử lại</button>
    {weekStart && <button type="button" onClick={() => setWeekStart('')}>Về tuần mặc định của kỳ</button>}
  </div>
  const data = result.data
  const analysis = data.analysis
  const selected = data.members.find((member) => member.id === selectedId) || data.members[0]
  return <div className="session-planning">
    <div className="planning-toolbar">
      <label>Chọn ngày để xem tuần
        <input type="date" value={weekStart || analysis.week_start}
          onChange={(event) => { setMessage(''); setWeekStart(weekStartFor(event.target.value)) }} />
      </label>
      <button type="button" onClick={() => { setMessage(''); setReload((value) => value + 1) }}>Làm mới</button>
    </div>
    <p>Tuần {formatDate(analysis.week_start)} – {formatDate(analysis.week_end)} · Kỳ {data.period.name}</p>
    {analysis.open_dates?.length > 0 && <p className="planning-note">Đã loại ngày tự đăng ký khỏi lịch cố định: {analysis.open_dates.map(formatDate).join(', ')}.</p>}
    {message && <p role="status">{message}</p>}
    {!data.can_edit && <p role="alert">Kỳ đã đóng. Chỉ được xem, không sửa lịch bận.</p>}
    {analysis.partial_week && <p role="alert">Tuần chỉ nằm một phần trong kỳ. Hệ thống vẫn kiểm tra đủ 4 buổi, không tự giảm chỉ tiêu.</p>}
    {data.can_manage && <>
      <div className="planning-metrics"><div><strong>{analysis.member_count}</strong><span>thành viên</span></div><div><strong>{analysis.required_slots}</strong><span>lượt cần xếp</span></div><div><strong>{analysis.capacity_slots}</strong><span>lượt tối đa</span></div></div>
      {analysis.member_count === 0 ? <p>Chưa có thành viên cố định đủ điều kiện trong kỳ này.</p>
        : analysis.possible ? <p className="planning-notice" role="status">Có thể xếp đủ 4 buổi/người. Còn tối đa {analysis.extra_slots} lượt thêm; lịch chưa được duyệt.</p>
          : <p className="planning-notice" role="alert">Còn thiếu {analysis.shortfall} lượt để mỗi người đủ 4 buổi. Xem ngày rảnh bên dưới để điều chỉnh.</p>}
      <details className="planning-help"><summary>Ngày rảnh của {data.members.length} thành viên</summary><div className="table-wrap"><table>
        <thead><tr><th>Thành viên</th><th>Ngày rảnh trong tuần</th><th>Khả năng đủ 4 buổi</th></tr></thead>
        <tbody>{data.members.map((member) => {
          const available = analysis.availability.find((row) => row.person_id === member.id)?.available_dates || []
          return <tr key={member.id}><td>{member.full_name}</td>
            <td>{available.length ? available.map(formatDate).join(', ') : 'Không có ngày rảnh'}</td>
            <td>{available.length < 4 ? `Thiếu ${4 - available.length} ngày rảnh` : 'Cần xét cùng sức chứa chung'}</td></tr>
        })}</tbody>
      </table></div></details>
    </>}
    {selected && <>
      {data.can_manage && <label>Chỉnh lịch bận của thành viên
        <select value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setMessage('') }}>
          {data.members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
        </select>
      </label>}
      <PreferenceEditor key={`${selected.id}:${selected.preferences.revision}`} periodId={periodId}
        period={data.period} member={selected} canEdit={data.can_edit}
        onSaved={() => { setMessage('Đã lưu lịch bận.'); setReload((value) => value + 1) }} />
    </>}
    {data.can_manage && <DraftPlanningPanel key={requestKey} periodId={periodId} weekStart={analysis.week_start} />}
  </div>
}

function PreferenceEditor({ periodId, period, member, canEdit, onSaved }) {
  const preferences = member.preferences
  const [busyDays, setBusyDays] = useState(preferences.busy_weekdays)
  const [overrides, setOverrides] = useState(preferences.date_overrides)
  const [date, setDate] = useState('')
  const [state, setState] = useState('busy')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function save(event) {
    event.preventDefault()
    if (lock.current || !canEdit) return
    lock.current = true
    setSaving(true); setError('')
    try {
      await api.sessionPlanning.save(periodId, member.id, preferencePayload(preferences, busyDays, overrides))
      if (mounted.current) onSaved()
    } catch (failure) {
      if (mounted.current) setError(errorText(failure))
    } finally {
      lock.current = false
      if (mounted.current) setSaving(false)
    }
  }

  function addOverride() {
    if (!date || date < period.start_date || date > period.end_date) {
      setError('Chọn một ngày nằm trong kỳ.'); return
    }
    if (!Object.hasOwn(overrides, date) && Object.keys(overrides).length >= 370) {
      setError('Chỉ được khai báo tối đa 370 ngày ngoại lệ.'); return
    }
    setOverrides((current) => ({ ...current, [date]: state }))
    setDate(''); setError('')
  }

  return <form onSubmit={save} className="planning-editor">
    <fieldset disabled={!canEdit || saving}>
      <legend>Lịch bận của {member.full_name}</legend>
      <p>Chạm những ngày bạn thường bận. Các ngày còn lại được hiểu là rảnh.</p>
      <div className="planning-weekdays">{WEEKDAYS.map(([day, label]) =>
        <label key={day} className={day === 4 ? 'planning-day-off' : busyDays.includes(day) ? 'planning-busy' : ''}>
          <input type="checkbox" disabled={day === 4} checked={day === 4 || busyDays.includes(day)} onChange={(event) =>
            setBusyDays((current) => event.target.checked ? [...current, day] : current.filter((value) => value !== day))} />
          <span>{label}</span><small>{day === 4 ? 'CLB nghỉ' : busyDays.includes(day) ? 'Bận' : 'Rảnh'}</small>
        </label>
      )}</div>
      <details className="planning-help"><summary>Bận đột xuất hoặc rảnh lại? {Object.keys(overrides).length > 0 && `(${Object.keys(overrides).length} ngày)`}</summary>
      <p>Chọn một ngày cụ thể để thay đổi lịch thường lệ. Thứ Năm CLB vẫn nghỉ.</p>
      <div className="planning-toolbar">
        <label>Chọn ngày<input type="date" value={date} min={period.start_date} max={period.end_date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Trạng thái<select value={state} onChange={(event) => setState(event.target.value)}>
          <option value="busy">Bận ngày này</option><option value="available">Rảnh ngày này</option>
        </select></label>
        <button type="button" onClick={addOverride}>Thêm ngày</button>
      </div>
      <ul className="planning-overrides">{Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)).map(([value, status]) =>
        <li key={value}><span>{formatDate(value)} — {status === 'busy' ? 'Bận' : 'Rảnh'}</span>
          <button type="button" aria-label={`Bỏ thay đổi ngày ${formatDate(value)}`} onClick={() => setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== value)))}>Bỏ thay đổi</button></li>
      )}</ul></details>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu lịch bận'}</button>
    </fieldset>
  </form>
}
