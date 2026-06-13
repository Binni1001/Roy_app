import { api } from '../../../api/client'
import { ActionGroup, Input, Panel, SelectPeople, SimpleTable } from '../../../components/common'
import { emptyPeriod } from '../../../constants/appConstants'
import { askConfirm, displayValue, formatDate, formatMoney } from '../../../utils/appUtils'

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
  return (
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
              <button onClick={() => editMember(member, submit)}>Sửa</button>
              <button className="danger" onClick={() => removeMember(member, submit)}>Xóa</button>
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
              <button onClick={() => editPeriod(period, submit)}>Sửa</button>
            </ActionGroup>
          )}
        />
      </Panel>
    </section>
  )
}

function editPeriod(period, submit) {
  const name = window.prompt('Tên kỳ', period.name || '')
  if (name === null) return
  const startDate = window.prompt('Ngày bắt đầu', period.start_date || '')
  if (startDate === null) return
  const endDate = window.prompt('Ngày kết thúc', period.end_date || '')
  if (endDate === null) return
  const fixedMemberFee = window.prompt('Phí cố định', period.fixed_member_fee || 0)
  if (fixedMemberFee === null) return
  const guestFeePerSession = window.prompt('Phí khách mỗi buổi', period.guest_fee_per_session || 0)
  if (guestFeePerSession === null) return
  const status = window.prompt('Trạng thái', period.status || 'draft')
  if (status === null) return
  submit(
    () => api.periods.update(period.id, {
      name,
      start_date: startDate,
      end_date: endDate,
      fixed_member_fee: Number(fixedMemberFee || 0),
      guest_fee_per_session: Number(guestFeePerSession || 0),
      status,
    }),
    'Đã cập nhật kỳ.',
  )
}

function editMember(member, submit) {
  const status = window.prompt('Trạng thái', member.status || 'fixed')
  if (status === null) return
  submit(() => api.periodMembers.update(member.id, { status }), 'Đã cập nhật thành viên trong kỳ.')
}

function removeMember(member, submit) {
  if (!askConfirm('Xóa thành viên khỏi kỳ này?')) return
  submit(() => api.periodMembers.remove(member.id), 'Đã xóa thành viên khỏi kỳ.')
}
