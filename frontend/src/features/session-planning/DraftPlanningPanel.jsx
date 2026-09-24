import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { errorText } from '../../utils/appUtils'
import { formatPlanningDate as formatDate, planningErrorCode, previewPayload, profilePayload, toggleDraftAssignment, WEEKDAYS } from './planningUtils'

export default function DraftPlanningPanel({ periodId, weekStart }) {
  const [opened, setOpened] = useState(false)
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  return <section className="planning-draft-section">
    <h3>Level, cặp ưu tiên và xếp thử</h3>
    <p>Chỉ admin xem nháp này. Level và cặp được lưu theo kỳ; nháp chỉnh tay chưa được lưu, sẽ mất khi tải lại, đổi tuần hoặc cập nhật đầu vào.</p>
    <button type="button" onClick={() => setOpened((value) => !value)}>{opened ? 'Đóng phần xếp thử' : 'Mở hồ sơ và xếp thử'}</button>
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
    {result.code === 'PLANNING_SCHEMA_NOT_READY' && <p>Chạy file 20260923_session_planning_profiles.sql. Phần lịch bận bên trên vẫn dùng độc lập.</p>}
    <button type="button" onClick={() => onReload()}>Tải lại đầu vào</button></div>
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
    <p>Thang level đang dùng: {inputs.levels.map((level) => level.label).join(' / ')}. Chưa nhập được giữ là “Chưa có level”, không coi là người mới.</p>
    {member && <>
      <label>Hồ sơ của thành viên<select value={selectedId} disabled={busy}
        onChange={(event) => setSelectedId(event.target.value)}>
        {inputs.members.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select></label>
      <ProfileEditor key={member.id} member={member} inputs={inputs} periodId={periodId} disabled={disabled} onSaved={onReload} />
    </>}
    <div className="table-wrap"><table>
      <thead><tr><th>Thành viên</th><th>Level</th><th>Người đi cùng ưu tiên</th></tr></thead>
      <tbody>{inputs.members.map((person) => <tr key={person.id}><td>{person.full_name}</td>
        <td>{levels.get(person.profile.level) || 'Chưa có level'}</td>
        <td>{person.profile.partner_unavailable ? 'Lựa chọn cũ không còn đủ điều kiện — cần cập nhật'
          : names.get(person.profile.preferred_partner_id) || 'Chưa chọn'}</td></tr>)}</tbody>
    </table></div>
    {!inputs.members.length && <p>Chưa có thành viên cố định hợp lệ để xếp thử.</p>}
    <div className="planning-toolbar">
      <button type="button" className="planning-primary" disabled={disabled || !inputs.members.length} onClick={() => preview(false)}>
        {busy ? 'Đang kiểm tra…' : draft ? 'Xếp thử lại (bỏ chỉnh tay)' : 'Tạo bản nháp thử'}
      </button>
      <button type="button" disabled={busy} onClick={() => onReload()}>Tải lại đầu vào (bỏ nháp)</button>
      {draft && <button type="button" disabled={disabled} onClick={() => preview(true)}>Kiểm tra nháp đã chỉnh</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    <p className="muted">Ưu tiên đủ lượt, phân bố số người, trộn level rồi ghép cặp. Đây là xếp thử, không bảo đảm cặp luôn đi cùng; chưa giữ lịch ổn định giữa các tuần hoặc kiểm tra trùng giờ CLB khác.</p>
    {draft && <>
      <h4>Bản nháp thử — CHƯA LƯU / CHƯA CÔNG BỐ</h4>
      {dirty ? <p role="alert">Bạn đã chỉnh tay. Bấm “Kiểm tra nháp đã chỉnh” để kiểm tra lại với dữ liệu mới nhất trên máy chủ.</p>
        : <>
          <p role={draft.complete ? 'status' : 'alert'}>{draft.complete ? 'Đủ 4 buổi cho mỗi người theo đầu vào vừa kiểm tra.'
            : `Nháp thiếu ${draft.shortfall} lượt so với chỉ tiêu 4 buổi/người. Chưa đáp ứng yêu cầu.`}</p>
          {draft.partial_week && <p role="alert">Tuần không trọn kỳ: vẫn giữ chỉ tiêu 4, chưa được phép coi đây là lịch đã duyệt.</p>}
          {draft.missing_level_ids.length > 0 && <p role="alert">Chưa có level: {draft.missing_level_ids.map((id) => names.get(id)).join(', ')}.</p>}
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
          <ul>{assignments.map((row) => <li key={row.person_id}>{names.get(row.person_id)} — {levels.get(inputs.members.find((person) => person.id === row.person_id)?.profile.level) || 'Chưa có level'}</li>)}</ul>
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
      <p>Nháp chưa tạo buổi thật, suất đăng ký, thông báo hoặc công nợ. Lưu phiên bản, duyệt và công bố sẽ có ở bước tiếp theo.</p>
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
      if (mounted.current) onSaved('Đã lưu hồ sơ. Đầu vào đã được tải lại; nháp cũ đã bỏ.')
    } catch (failure) { if (mounted.current) setError(errorText(failure)) }
    finally { lock.current = false; if (mounted.current) setSaving(false) }
  }
  return <form className="planning-editor" onSubmit={save}><fieldset disabled={disabled || saving}>
    <legend>Level và cặp ưu tiên — {member.full_name}</legend>
    <div className="planning-toolbar">
      <label>Level<select value={level} onChange={(event) => setLevel(event.target.value)}>
        <option value="">Chưa có level</option>
        {inputs.levels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label>
      <label>Người đi cùng ưu tiên<select value={partner} onChange={(event) => setPartner(event.target.value)}>
        <option value="">Không chọn</option>
        {inputs.members.filter((person) => person.id !== member.id).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select></label>
    </div>
    <p>Chọn một người để ưu tiên cùng buổi, không bắt buộc đánh đôi. Không tự sửa hồ sơ của người kia hoặc buộc cả nhóm đi cùng.</p>
    {member.profile.partner_unavailable && <p role="alert">Người đi cùng cũ không còn đủ điều kiện. Khi lưu, hãy chọn người mới hoặc để “Không chọn”.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="submit">{saving ? 'Đang lưu…' : 'Lưu hồ sơ và làm mới đầu vào'}</button>
    <p className="muted">Phiên bản {member.profile.revision}. Lưu sẽ bỏ nháp đang xem để tránh dùng đầu vào cũ.</p>
  </fieldset></form>
}
