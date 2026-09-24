import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Panel } from '../../components/common'
import { errorText } from '../../utils/appUtils'
import { formatPlanningDate as formatDate, preferencePayload, WEEKDAYS, weekStartFor } from './planningUtils'
import DraftPlanningPanel from './DraftPlanningPanel'
import './sessionPlanning.css'

export default function SessionPlanningPanel({ periodId }) {
  const [opened, setOpened] = useState(false)
  return <Panel title="Chuẩn bị xếp lịch buổi cầu" action={
    <button type="button" disabled={!periodId} onClick={() => setOpened((value) => !value)}>
      {opened ? 'Thu gọn' : 'Lịch bận và sức chứa'}
    </button>
  }>
    <p>8 người/buổi · 17:30–19:30 · Nghỉ thứ Năm · 4 buổi cố định/người/tuần.</p>
    <p className="muted">Lưu lịch bận, kiểm tra sức chứa; admin có thể nhập level, cặp ưu tiên và xếp thử. Chưa công bố lịch, giữ chỗ, gửi thông báo hoặc tạo công nợ.</p>
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
      <label>Xem tuần chứa ngày
        <input type="date" value={weekStart || analysis.week_start}
          onChange={(event) => { setMessage(''); setWeekStart(weekStartFor(event.target.value)) }} />
      </label>
      <button type="button" onClick={() => { setMessage(''); setReload((value) => value + 1) }}>Tải lại dữ liệu</button>
    </div>
    <p>Tuần {formatDate(analysis.week_start)} – {formatDate(analysis.week_end)} · Kỳ {data.period.name}</p>
    {message && <p role="status">{message}</p>}
    {!data.can_edit && <p role="alert">Kỳ đã đóng. Chỉ được xem, không sửa lịch bận.</p>}
    {analysis.partial_week && <p role="alert">Tuần chỉ nằm một phần trong kỳ. Hệ thống vẫn kiểm tra đủ 4 buổi, không tự giảm chỉ tiêu.</p>}
    {data.can_manage && <>
      <p>{analysis.member_count} thành viên cố định hợp lệ · Cần {analysis.required_slots} lượt · Sức chứa {analysis.capacity_slots} lượt.</p>
      {analysis.member_count === 0 ? <p>Chưa có thành viên cố định đủ điều kiện trong kỳ này.</p>
        : analysis.possible ? <p role="status">Lịch rảnh hiện tại cho phép phân đủ 4 buổi/người; còn tối đa {analysis.extra_slots} lượt thêm. Đây chưa phải lịch đã được xếp hoặc duyệt.</p>
          : <p role="alert">Không thể phân đủ 4 buổi/người với dữ liệu hiện tại: thiếu {analysis.shortfall} lượt. Kiểm tra lịch bận và sức chứa; không tự tăng quá 8 người/buổi.</p>}
      <div className="table-wrap"><table>
        <thead><tr><th>Thành viên</th><th>Ngày rảnh trong tuần</th><th>Khả năng đủ 4 buổi</th></tr></thead>
        <tbody>{data.members.map((member) => {
          const available = analysis.availability.find((row) => row.person_id === member.id)?.available_dates || []
          return <tr key={member.id}><td>{member.full_name}</td>
            <td>{available.length ? available.map(formatDate).join(', ') : 'Không có ngày rảnh'}</td>
            <td>{available.length < 4 ? `Thiếu ${4 - available.length} ngày rảnh` : 'Cần xét cùng sức chứa chung'}</td></tr>
        })}</tbody>
      </table></div>
    </>}
    {selected && <>
      {data.can_manage && <label>Chỉnh lịch bận của thành viên
        <select value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setMessage('') }}>
          {data.members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
        </select>
      </label>}
      <PreferenceEditor key={`${selected.id}:${selected.preferences.revision}`} periodId={periodId}
        period={data.period} member={selected} canEdit={data.can_edit}
        onSaved={() => { setMessage('Đã lưu lịch bận. Chưa tạo hay thay đổi suất tham gia.'); setReload((value) => value + 1) }} />
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
      <p>Đánh dấu các ngày thường bận trong kỳ. Ngày không đánh dấu được hiểu là rảnh; thứ Năm CLB nghỉ.</p>
      <div className="planning-weekdays">{WEEKDAYS.filter(([day]) => day !== 4).map(([day, label]) =>
        <label key={day}><input type="checkbox" checked={busyDays.includes(day)} onChange={(event) =>
          setBusyDays((current) => event.target.checked ? [...current, day] : current.filter((value) => value !== day))} />{label}</label>
      )}</div>
      <p>Ngoại lệ theo ngày: dùng khi bận đột xuất hoặc rảnh lại vào ngày thường bận. Ngoại lệ không mở buổi vào thứ Năm.</p>
      <div className="planning-toolbar">
        <label>Ngày ngoại lệ<input type="date" value={date} min={period.start_date} max={period.end_date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Trạng thái<select value={state} onChange={(event) => setState(event.target.value)}>
          <option value="busy">Bận ngày này</option><option value="available">Rảnh ngày này</option>
        </select></label>
        <button type="button" onClick={addOverride}>Thêm ngoại lệ</button>
      </div>
      <ul className="planning-overrides">{Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)).map(([value, status]) =>
        <li key={value}><span>{formatDate(value)} — {status === 'busy' ? 'Bận' : 'Rảnh'}</span>
          <button type="button" onClick={() => setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== value)))}>Dùng lịch thường lệ</button></li>
      )}</ul>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu lịch bận'}</button>
      <p className="muted">Phiên bản {preferences.revision}. Nếu người khác vừa sửa, hệ thống sẽ yêu cầu tải lại để tránh ghi đè.</p>
    </fieldset>
  </form>
}
