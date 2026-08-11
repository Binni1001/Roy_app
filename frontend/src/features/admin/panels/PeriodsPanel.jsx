import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable, StatusBadge } from '../../../components/common'
import { emptyPeriod } from '../../../constants/appConstants'
import { formatDate, formatMoney } from '../../../utils/appUtils'

export function PeriodsPanel({ people, periods, members, periodForm, memberForm, selectedPeriodId, setForm, submit }) {
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)

  return (
    <>
      <section className="grid one">
        <Panel
          title="Các kỳ"
          action={<button onClick={() => setShowAddPeriod(true)}>+ Tạo kỳ</button>}
        >
          <SimpleTable
            rows={periods}
            columns={[
              ['name', 'Tên kỳ'],
              ['start_date', 'Bắt đầu', formatDate],
              ['end_date', 'Kết thúc', formatDate],
              ['fixed_member_fee', 'Phí cố định', formatMoney],
              ['guest_fee_per_session', 'Phí khách', formatMoney],
              ['status', 'Trạng thái', (v) => <StatusBadge value={v} />],
            ]}
            actions={(period) => (
              <ActionGroup>
                <button onClick={() => setEditingPeriod(period)}>Sửa</button>
              </ActionGroup>
            )}
          />
        </Panel>

        <Panel
          title="Thành viên trong kỳ"
          action={<button onClick={() => setShowAddMember(true)}>+ Thêm vào kỳ</button>}
        >
          <SimpleTable
            rows={members}
            columns={[
              ['person.full_name', 'Người'],
              ['status', 'Trạng thái', (v) => <StatusBadge value={v} />],
              ['exempt_shuttle', 'Miễn cầu', (v) => v ? <span style={{ color: '#d8ae52', fontSize: 12 }}>✓ Miễn</span> : '—'],
              ['period.fixed_member_fee', 'Phí cố định kỳ', formatMoney],
            ]}
            actions={(member) => (
              <ActionGroup>
                <button onClick={() => setEditingMember(member)}>Sửa</button>
                <button className="danger" onClick={() => setDeletingMember(member)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>

      {showAddPeriod && (
        <Modal title="Tạo kỳ mới" onClose={() => setShowAddPeriod(false)}>
          <form className="form" onSubmit={async (e) => {
            e.preventDefault()
            if (periodForm.end_date && periodForm.start_date && periodForm.end_date < periodForm.start_date) {
              alert('Ngày kết thúc phải sau ngày bắt đầu.')
              return
            }
            const currentGroupId = periods.find((period) => period.id === selectedPeriodId)?.group_id || null
            const result = await submit(
              () => api.periods.create({
                ...periodForm,
                group_id: currentGroupId,
                fixed_member_fee: Math.max(0, Number(periodForm.fixed_member_fee || 0)),
                guest_fee_per_session: Math.max(0, Number(periodForm.guest_fee_per_session || 0)),
              }),
              'Đã tạo kỳ mới.',
              'global',
            )
            if (!result) return
            setForm('period', emptyPeriod)
            setShowAddPeriod(false)
          }}>
            <Input label="Tên kỳ" value={periodForm.name} onChange={(v) => setForm('period', { name: v })} required />
            <Input label="Ngày bắt đầu" type="date" value={periodForm.start_date} onChange={(v) => setForm('period', { start_date: v })} required />
            <Input label="Ngày kết thúc" type="date" value={periodForm.end_date} onChange={(v) => setForm('period', { end_date: v })} required />
            <Input label="Phí cố định" type="number" value={periodForm.fixed_member_fee} onChange={(v) => setForm('period', { fixed_member_fee: v })} />
            <Input label="Phí khách mỗi buổi" type="number" value={periodForm.guest_fee_per_session} onChange={(v) => setForm('period', { guest_fee_per_session: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowAddPeriod(false)}>Hủy</button>
              <button type="submit">Tạo kỳ</button>
            </footer>
          </form>
        </Modal>
      )}

      {showAddMember && (
        <Modal title="Thêm thành viên vào kỳ" onClose={() => setShowAddMember(false)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault()
            submit(
              () => api.periodMembers.create({ period_id: selectedPeriodId, person_id: memberForm.person_id }),
              'Đã thêm thành viên vào kỳ.',
            )
            setShowAddMember(false)
          }}>
            <SelectPeople people={people} value={memberForm.person_id} onChange={(v) => setForm('member', { person_id: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowAddMember(false)}>Hủy</button>
              <button type="submit">Thêm vào kỳ</button>
            </footer>
          </form>
        </Modal>
      )}

      {editingPeriod && (
        <PeriodEditModal
          period={editingPeriod}
          onClose={() => setEditingPeriod(null)}
          onSubmit={(payload) => {
            submit(() => api.periods.update(editingPeriod.id, payload), 'Đã cập nhật kỳ.')
            setEditingPeriod(null)
          }}
        />
      )}

      {editingMember && (
        <MemberEditModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSubmit={(payload) => {
            submit(() => api.periodMembers.update(editingMember.id, payload), 'Đã cập nhật thành viên trong kỳ.')
            setEditingMember(null)
          }}
        />
      )}

      {deletingMember && (
        <ConfirmModal
          title="Xóa thành viên khỏi kỳ"
          message={`Bạn chắc chắn muốn xóa ${deletingMember.person?.full_name || 'thành viên này'} khỏi kỳ đang chọn?`}
          confirmText="Xóa"
          danger
          onClose={() => setDeletingMember(null)}
          onConfirm={() => {
            submit(() => api.periodMembers.remove(deletingMember.id), 'Đã xóa thành viên khỏi kỳ.')
            setDeletingMember(null)
          }}
        />
      )}
    </>
  )
}

function PeriodEditModal({ period, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    name: period.name || '',
    start_date: period.start_date || '',
    end_date: period.end_date || '',
    fixed_member_fee: period.fixed_member_fee || 0,
    guest_fee_per_session: period.guest_fee_per_session || 0,
    status: period.status || 'draft',
  })
  function update(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  return (
    <Modal title="Sửa kỳ đánh" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (draft.end_date && draft.start_date && draft.end_date < draft.start_date) {
          alert('Ngày kết thúc phải sau ngày bắt đầu.')
          return
        }
        onSubmit({ ...draft, fixed_member_fee: Math.max(0, Number(draft.fixed_member_fee || 0)), guest_fee_per_session: Math.max(0, Number(draft.guest_fee_per_session || 0)) })
      }}>
        <Input label="Tên kỳ" value={draft.name} onChange={(v) => update('name', v)} required />
        <Input label="Ngày bắt đầu" type="date" value={draft.start_date} onChange={(v) => update('start_date', v)} required />
        <Input label="Ngày kết thúc" type="date" value={draft.end_date} onChange={(v) => update('end_date', v)} required />
        <Input label="Phí cố định" type="number" value={draft.fixed_member_fee} onChange={(v) => update('fixed_member_fee', v)} />
        <Input label="Phí khách mỗi buổi" type="number" value={draft.guest_fee_per_session} onChange={(v) => update('guest_fee_per_session', v)} />
        <label>Trạng thái
          <select value={draft.status} onChange={(e) => update('status', e.target.value)}>
            <option value="draft">Bản nháp</option>
            <option value="open">Đang mở</option>
            <option value="closed">Đã chốt</option>
          </select>
        </label>
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

function MemberEditModal({ member, onClose, onSubmit }) {
  const [status, setStatus] = useState(member.status || 'fixed')
  const [exemptShuttle, setExemptShuttle] = useState(member.exempt_shuttle || false)

  return (
    <Modal title="Sửa thành viên trong kỳ" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit({ status, exempt_shuttle: exemptShuttle }) }}>
        <label>Trạng thái
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="fixed">Đánh cố định</option>
            <option value="guest">Đánh vãng lai</option>
            <option value="inactive">Tạm nghỉ</option>
          </select>
        </label>
        {status === 'fixed' && (
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={exemptShuttle}
              onChange={(e) => setExemptShuttle(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#d8ae52' }}
            />
            Miễn tiền cầu cuối kỳ
          </label>
        )}
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

export default PeriodsPanel
