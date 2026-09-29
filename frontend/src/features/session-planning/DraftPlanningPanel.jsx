import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { errorText } from '../../utils/appUtils'
import { formatPlanningDate as formatDate, planningErrorCode, previewPayload, profilePayload, toggleDraftAssignment, WEEKDAYS } from './planningUtils'

export default function DraftPlanningPanel({ periodId, weekStart }) {
  const [opened, setOpened] = useState(false)
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  return <section className="planning-draft-section">
    <div><span className="planning-eyebrow">Dành cho quản trị</span><h3>Xếp thử lịch tuần</h3></div>
    <p>Chọn trình độ, người muốn đi cùng và tạo một lịch gợi ý.</p>
    <p className="planning-notice">Nháp chỉ để xem thử, chưa lưu hay công bố. Đổi tuần hoặc làm mới sẽ bỏ nháp.</p>
    <button type="button" aria-expanded={opened} onClick={() => setOpened((value) => !value)}>{opened ? 'Thu gọn phần xếp thử' : 'Bắt đầu xếp thử'}</button>
    {message && <p role="status">{message}</p>}
    {opened && <DraftInputs key={`${periodId}:${weekStart}:${reload}`} periodId={periodId} weekStart={weekStart}
      onReload={(notice = '') => { setMessage(notice); setReload((value) => value + 1) }} />}
  </section>
}

function DraftInputs({ periodId, weekStart, onReload }) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    let active = true
    api.sessionPlanning.draftInputs(periodId, weekStart).then(
      (data) => { if (active) setResult({ data }) },
      (error) => { if (active) setResult({ error: errorText(error), code: planningErrorCode(error) }) },
    )
    return () => { active = false }
  }, [periodId, weekStart])
  if (!result) return <p role="status">Đang tải hồ sơ xếp lịch…</p>
  if (result.error) return <div role="alert"><p>{result.error}</p>
    {result.code === 'PLANNING_SCHEMA_NOT_READY' && <p>Phần xếp thử chưa sẵn sàng. Bạn vẫn có thể lưu lịch bận ở bên trên.</p>}
    <button type="button" onClick={() => onReload()}>Thử lại</button></div>
  return <DraftWorkspace inputs={result.data} periodId={periodId} onReload={onReload} />
}

function DraftWorkspace({ inputs, periodId, onReload }) {
  const [selectedId, setSelectedId] = useState(inputs.members[0]?.id || '')
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const lock = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const member = inputs.members.find((person) => person.id === selectedId)
  const names = new Map(inputs.members.map((person) => [person.id, person.full_name]))
  const levels = new Map(inputs.levels.map((level) => [level.value, level.label]))
  const disabled = busy || stale || !inputs.can_edit

  async function preview(checkOnly) {
    if (lock.current || disabled) return
    lock.current = true; setBusy(true); setError(''); setDirty(true)
    try {
      const result = await api.sessionPlanning.preview(periodId, previewPayload(inputs, checkOnly ? draft.assignments : undefined))
      if (mounted.current) { setDraft(result); setDirty(false) }
    } catch (failure) {
      if (mounted.current) {
        setError(errorText(failure))
        if (['PLANNING_STALE_INPUT', 'PLANNING_PERIOD_CLOSED', 'PLANNING_FORBIDDEN'].includes(planningErrorCode(failure))) { setStale(true); setDraft(null) }
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <div className="planning-draft-workspace">
    {!inputs.can_edit && <p role="alert">Kỳ đã đóng: chỉ xem hồ sơ, không lưu hoặc xếp nháp mới.</p>}
    {inputs.analysis.open_dates?.length > 0 && <p className="planning-notice">Ngày tự đăng ký: {inputs.analysis.open_dates.map(formatDate).join(', ')}. Không xếp người vào các ngày này, kể cả khi đã đóng đăng ký.</p>}
    <h4 className="planning-step"><span>1</span> Chuẩn bị thông tin người chơi</h4>
    {member && <>
      <label>Hồ sơ của thành viên<select value={selectedId} disabled={busy}
        onChange={(event) => setSelectedId(event.target.value)}>
        {inputs.members.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select></label>
      <ProfileEditor key={member.id} member={member} inputs={inputs} periodId={periodId} disabled={disabled} onSaved={onReload} />
    </>}
    <details className="planning-help"><summary>Xem thông tin cả nhóm</summary><div className="table-wrap"><table>
      <thead><tr><th>Thành viên</th><th>Trình độ</th><th>Người đi cùng ưu tiên</th></tr></thead>
      <tbody>{inputs.members.map((person) => <tr key={person.id}><td>{person.full_name}</td>
        <td>{levels.get(person.profile.level) || 'Chưa chọn trình độ'}</td>
        <td>{person.profile.partner_unavailable ? 'Lựa chọn cũ không còn đủ điều kiện — cần cập nhật'
          : names.get(person.profile.preferred_partner_id) || 'Chưa chọn'}</td></tr>)}</tbody>
    </table></div></details>
    {!inputs.members.length && <p>Chưa có thành viên cố định hợp lệ để xếp thử.</p>}
    <h4 className="planning-step"><span>2</span> Tạo lịch gợi ý</h4>
    <div className="planning-toolbar">
      <button type="button" className="planning-primary" disabled={disabled || !inputs.members.length} onClick={() => preview(false)}>
        {busy ? 'Đang xếp lịch…' : draft ? 'Xếp lại từ đầu' : 'Xếp thử cho cả nhóm'}
      </button>
      <button type="button" disabled={busy} onClick={() => onReload()}>Làm mới & bỏ nháp</button>
      {draft && <button type="button" disabled={disabled} onClick={() => preview(true)}>Kiểm tra nháp đã chỉnh</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    <details className="planning-help"><summary>Cách lịch được gợi ý</summary><p>Ưu tiên đủ lượt, chia đều số người, cân bằng trình độ rồi xét người đi cùng. Cặp ưu tiên không bắt buộc luôn cùng buổi. Chưa kiểm tra trùng giờ với CLB khác hoặc giữ lịch cố định qua các tuần.</p></details>
    {draft && <>
      <div className="planning-draft-heading"><h4>Lịch gợi ý của tuần</h4><span>CHƯA LƯU / CHƯA CÔNG BỐ</span></div>
      {dirty ? <p role="alert">Bạn đã chỉnh tay. Bấm “Kiểm tra nháp đã chỉnh” để kiểm tra lại với dữ liệu mới nhất trên máy chủ.</p>
        : <>
          <p role={draft.complete ? 'status' : 'alert'}>{draft.complete ? 'Đủ 4 buổi cho mỗi người theo đầu vào vừa kiểm tra.'
            : `Nháp thiếu ${draft.shortfall} lượt so với chỉ tiêu 4 buổi/người. Chưa đáp ứng yêu cầu.`}</p>
          {draft.partial_week && <p role="alert">Tuần không trọn kỳ: vẫn giữ chỉ tiêu 4, chưa được phép coi đây là lịch đã duyệt.</p>}
          {draft.missing_level_ids.length > 0 && <p role="alert">Chưa chọn trình độ: {draft.missing_level_ids.map((id) => names.get(id)).join(', ')}.</p>}
          {draft.pairs.map((pair) => <p key={pair.person_ids.join(':')}>
            Cặp {pair.person_ids.map((id) => names.get(id)).join(' + ')}: cùng {pair.shared_dates.length}/4 buổi.
          </p>)}
        </>}
      <div className="planning-draft-days">{inputs.analysis.dates.map((date) => {
        const assignments = draft.assignments.filter((row) => row.date === date)
        const dayNumber = new Date(`${date}T00:00:00Z`).getUTCDay() || 7
        return <article className="planning-day" key={date}>
          <h4>{WEEKDAYS.find(([day]) => day === dayNumber)?.[1]} · {formatDate(date)}</h4>
          <p>{assignments.length}/8 người · 17:30–19:30 · 1 sân</p>
          <details className="planning-roster"><summary>Xem {assignments.length} người được gợi ý</summary>
          <ul>{assignments.map((row) => <li key={row.person_id}>{names.get(row.person_id)} — {levels.get(inputs.members.find((person) => person.id === row.person_id)?.profile.level) || 'Chưa chọn trình độ'}</li>)}</ul></details>
          {!assignments.length && <p>Chưa xếp người.</p>}
          <details><summary>Chỉnh người trong ngày</summary>
            <p>Bỏ chọn ngày cũ trước khi chuyển người đã đủ 4 buổi sang ngày mới.</p>
            <div className="planning-day-choices">{inputs.members.map((person) => {
              const checked = assignments.some((row) => row.person_id === person.id)
              const available = inputs.analysis.availability.find((row) => row.person_id === person.id)?.available_dates.includes(date)
              const count = draft.assignments.filter((row) => row.person_id === person.id).length
              const reason = !available ? 'Bận' : !checked && assignments.length >= 8 ? 'Đủ 8 người' : !checked && count >= 4 ? 'Đủ 4 buổi' : ''
              return <label key={person.id}><input type="checkbox" checked={checked} disabled={disabled || (!checked && Boolean(reason))}
                onChange={(event) => { setDraft((current) => ({ ...current, assignments: toggleDraftAssignment(current.assignments, person.id, date, event.target.checked) })); setDirty(true) }} />
                {person.full_name}{reason && ` (${reason})`}
              </label>
            })}</div>
          </details>
        </article>
      })}</div>
      <div className="table-wrap"><table><thead><tr><th>Thành viên</th><th>Buổi được xếp</th><th>Còn thiếu</th></tr></thead>
        <tbody>{inputs.members.map((person) => {
          const count = draft.assignments.filter((row) => row.person_id === person.id).length
          return <tr key={person.id}><td>{person.full_name}</td><td>{count}/4</td><td>{4 - count}</td></tr>
        })}</tbody></table></div>
      <p className="planning-note">Đây chưa phải lịch tham gia chính thức. Đóng trang sẽ mất bản nháp.</p>
    </>}
  </div>
}

function ProfileEditor({ member, inputs, periodId, disabled, onSaved }) {
  const [level, setLevel] = useState(member.profile.level ?? '')
  const [partner, setPartner] = useState(member.profile.preferred_partner_id || '')
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const lock = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function save(event) {
    event.preventDefault()
    if (lock.current || disabled) return
    lock.current = true; setSaving(true); setError('')
    try {
      await api.sessionPlanning.saveProfile(periodId, member.id, profilePayload(member.profile, level, partner))
      if (mounted.current) onSaved('Đã lưu thông tin người chơi. Bạn có thể xếp thử lại.')
    } catch (failure) { if (mounted.current) setError(errorText(failure)) }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }
  return <form className="planning-editor" onSubmit={save}><fieldset disabled={disabled || saving}>
    <legend>Thông tin của {member.full_name}</legend>
    <div className="planning-toolbar">
      <label>Trình độ<select value={level} onChange={(event) => setLevel(event.target.value)}>
        <option value="">Chưa chọn trình độ</option>
        {inputs.levels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
      <label>Người đi cùng ưu tiên<select value={partner} onChange={(event) => setPartner(event.target.value)}>
        <option value="">Không chọn</option>
        {inputs.members.filter((person) => person.id !== member.id).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select></label>
    </div>
    <p>Người đi cùng là một mong muốn, không bắt buộc đánh đôi hoặc luôn cùng buổi.</p>
    {member.profile.partner_unavailable && <p role="alert">Người đi cùng cũ không còn đủ điều kiện. Khi lưu, hãy chọn người mới hoặc để “Không chọn”.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="submit">{saving ? 'Đang lưu…' : 'Lưu thông tin người chơi'}</button>
    <p className="planning-note">Lưu thông tin sẽ bỏ bản nháp đang xem.</p>
  </fieldset></form>
}
