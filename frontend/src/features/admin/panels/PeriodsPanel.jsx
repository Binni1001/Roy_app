import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { emptyPeriod } from '../../../constants/appConstants'
import { displayValue, formatDate, formatMoney } from '../../../utils/appUtils'

export function PeriodsPanel({
  people,
  periods,
  members,
  periodForm,
  memberForm,
  selectedPeriodId,
  setForm,
  submit,
}) {
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)

  return (
    <>
      <section className="grid two">
        <Panel title="Tạo kỳ">
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            submit(
              () => api.periods.create({
                ...periodForm,
                fixed_member_fee: Number(periodForm.fixed_member_fee || 0),
                guest_fee_per_session: Number(periodForm.guest_fee_per_session || 0),
              }),
              'Đã tạo kỳ mới.',
            )
            setForm('period', emptyPeriod)
          }}
        >
          <Input label="Tên kỳ" value={periodForm.name} onChange={(value) => setForm('period', { name: value })} required />
          <Input label="Ngày bắt đầu" type="date" value={periodForm.start_date} onChange={(value) => setForm('period', { start_date: value })} required />
          <Input label="Ngày kết thúc" type="date" value={periodForm.end_date} onChange={(value) => setForm('period', { end_date: value })} required />
          <Input label="Phí cố định" type="number" value={periodForm.fixed_member_fee} onChange={(value) => setForm('period', { fixed_member_fee: value })} />
          <Input label="Phí khách mỗi buổi" type="number" value={periodForm.guest_fee_per_session} onChange={(value) => setForm('period', { guest_fee_per_session: value })} />
          <button>Tạo kỳ</button>
        </form>
        </Panel>
        <Panel title="Thành viên trong kỳ">
        <form
          className="form compact"
          onSubmit={(event) => {
            event.preventDefault()
            submit(
              () =>
                  api.periodMembers.create({
                    period_id: selectedPeriodId,
                    person_id: memberForm.person_id,
                  }),
                'Đã thêm thành viên vào kỳ.',
              )
          }}
        >
          <SelectPeople people={people} value={memberForm.person_id} onChange={(value) => setForm('member', { person_id: value })} />
          <button>Thêm vào kỳ</button>
        </form>
        <SimpleTable
          rows={members}
          columns={[
            ['person.full_name', 'Người'],
            ['status', 'Trạng thái', displayValue],
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
        <Panel title="Các kỳ" wide>
        <SimpleTable
          rows={periods}
          columns={[
            ['name', 'Tên kỳ'],
            ['start_date', 'Bắt đầu', formatDate],
            ['end_date', 'Kết thúc', formatDate],
            ['fixed_member_fee', 'Phí cố định', formatMoney],
            ['guest_fee_per_session', 'Phí khách', formatMoney],
            ['status', 'Trạng thái', displayValue],
          ]}
          actions={(period) => (
            <ActionGroup>
              <button onClick={() => setEditingPeriod(period)}>Sửa</button>
            </ActionGroup>
          )}
        />
        </Panel>
      </section>
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

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <Modal title="Sửa kỳ đánh" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            ...draft,
            fixed_member_fee: Number(draft.fixed_member_fee || 0),
            guest_fee_per_session: Number(draft.guest_fee_per_session || 0),
          })
        }}
      >
        <Input label="Tên kỳ" value={draft.name} onChange={(value) => update('name', value)} required />
        <Input label="Ngày bắt đầu" type="date" value={draft.start_date} onChange={(value) => update('start_date', value)} required />
        <Input label="Ngày kết thúc" type="date" value={draft.end_date} onChange={(value) => update('end_date', value)} required />
        <Input label="Phí cố định" type="number" value={draft.fixed_member_fee} onChange={(value) => update('fixed_member_fee', value)} />
        <Input label="Phí khách mỗi buổi" type="number" value={draft.guest_fee_per_session} onChange={(value) => update('guest_fee_per_session', value)} />
        <label>
          Trạng thái
          <select value={draft.status} onChange={(event) => update('status', event.target.value)}>
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

  return (
    <Modal title="Sửa thành viên trong kỳ" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({ status })
        }}
      >
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="fixed">Đánh cố định</option>
            <option value="guest">Đánh vãng lai</option>
            <option value="inactive">Tạm nghỉ</option>
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
