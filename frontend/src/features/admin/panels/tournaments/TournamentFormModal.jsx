import { useState } from 'react'
import { Modal } from '../../../../components/common'
import { defaultKnockoutStart, validKnockoutStarts } from '../../../tournaments/tournamentUtils'

const EMPTY = {
  name: '', description: '', group_count: 2, knockout_start: 'semifinal',
  best_of: 3, third_place_enabled: false, start_date: '', end_date: '', status: 'draft',
}

export function TournamentFormModal({ initial, onClose, onSubmit, saving }) {
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState({ ...EMPTY, ...initial })

  function changeGroupCount(value) {
    const groupCount = Number(value)
    setForm((current) => ({ ...current, group_count: groupCount, knockout_start: defaultKnockoutStart(groupCount) }))
  }

  return (
    <Modal title={editing ? 'Sửa thông tin giải' : 'Tạo giải đấu đôi'} onClose={onClose}>
      <form className="form tour-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form) }}>
        <label>Tên giải<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} required /></label>
        <label>Mô tả<textarea value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></label>
        <div className="tour-form-grid">
          <label>Ngày bắt đầu<input type="date" value={form.start_date || ''} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
          <label>Ngày kết thúc<input type="date" value={form.end_date || ''} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></label>
          <label>Số bảng<select value={form.group_count} onChange={(event) => changeGroupCount(event.target.value)} disabled={editing}>
            {[1, 2, 3, 4].map((value) => <option value={value} key={value}>{value} bảng</option>)}
          </select></label>
          <label>Vòng trong bắt đầu<select value={form.knockout_start} onChange={(event) => setForm({ ...form, knockout_start: event.target.value })} disabled={editing}>
            {validKnockoutStarts(form.group_count).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label>Thể thức<select value={form.best_of} onChange={(event) => setForm({ ...form, best_of: Number(event.target.value) })}>
            <option value={1}>1 hiệp</option><option value={3}>3 hiệp, thắng 2</option><option value={5}>5 hiệp, thắng 3</option>
          </select></label>
          {editing && <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="draft">Bản nháp</option><option value="group_stage">Vòng bảng</option><option value="knockout">Vòng trong</option><option value="completed">Đã kết thúc</option><option value="cancelled">Đã hủy</option>
          </select></label>}
        </div>
        <label className="tour-check-line"><input type="checkbox" checked={Boolean(form.third_place_enabled)} onChange={(event) => setForm({ ...form, third_place_enabled: event.target.checked })} />Tổ chức trận tranh hạng ba</label>
        <footer className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo giải'}</button></footer>
      </form>
    </Modal>
  )
}
