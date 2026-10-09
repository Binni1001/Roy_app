import { useState } from 'react'
import { isActivityPerson } from '../../../utils/activityEligibility'
import { api } from '../../../api/client'
import { ActionGroup, ConfirmModal, Input, Modal, Panel, SimpleTable, StatusBadge } from '../../../components/common'
import { emptyPeriod } from '../../../constants/appConstants'
import { formatDate, formatMoney } from '../../../utils/appUtils'

export function PeriodsPanel({ people, periods, members, periodForm, selectedPeriodId, setForm, submit, submitting, canManageMembers = true }) {
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
          action={canManageMembers && <button onClick={() => setShowAddMember(true)} disabled={!selectedPeriodId || members.some((member) => member.shuttle_settled)}>+ Thêm vào kỳ</button>}
        >
          <SimpleTable
            rows={members}
            columns={[
              ['person.full_name', 'Người'],
              ['status', 'Trạng thái', (v) => <StatusBadge value={v} />],
              ['shuttle_discount_percent', 'Miễn cầu', (v) => v ? `Miễn ${v}%` : 'Không miễn'],
              ['period.fixed_member_fee', 'Phí cố định kỳ', formatMoney],
            ]}
            actions={canManageMembers ? (member) => (
              <ActionGroup>
                <button onClick={() => setEditingMember(member)}>Sửa</button>
                <button className="danger" disabled={member.shuttle_settled} onClick={() => setDeletingMember(member)}>Xóa</button>
              </ActionGroup>
            ) : undefined}
          />
          {!canManageMembers && <p className="muted">Bạn có thể xem thành viên. Thao tác thay đổi có liên quan công nợ hiện cần owner xử lý.</p>}
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
        <AddMembersModal
          people={people}
          members={members}
          submitting={submitting}
          onClose={() => setShowAddMember(false)}
          onSubmit={async (personIds) => {
            const result = await submit(
              () => api.periodMembers.createBulk({ period_id: selectedPeriodId, person_ids: personIds }),
              `Đã thêm ${personIds.length} người vào kỳ.`,
            )
            if (result) setShowAddMember(false)
            return result
          }}
        />
      )}

      {editingPeriod && (
        <PeriodEditModal
          period={editingPeriod}
          onClose={() => setEditingPeriod(null)}
          onSubmit={async (payload) => {
            const result = await submit(
              () => api.periods.update(editingPeriod.id, payload),
              'Đã cập nhật kỳ.',
              'global',
            )
            if (result) setEditingPeriod(null)
          }}
        />
      )}

      {editingMember && (
        <MemberEditModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSubmit={async (payload) => {
            const result = await submit(() => api.periodMembers.update(editingMember.id, payload), 'Đã cập nhật thành viên trong kỳ.')
            if (result) setEditingMember(null)
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

function AddMembersModal({ people, members, onClose, onSubmit, submitting }) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const existingIds = new Set(members.map((member) => member.person_id || member.person?.id))
  const normalizedQuery = query.trim().toLowerCase()
  const availablePeople = people
    .filter((person) => isActivityPerson(person) && !existingIds.has(person.id))
    .filter((person) => {
      if (!normalizedQuery) return true
      return [person.full_name, person.nickname, person.email, person.phone]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
    })
    .sort((left, right) => (left.full_name || '').localeCompare(right.full_name || '', 'vi'))

  const selectedSet = new Set(selectedIds)
  const allVisibleSelected = availablePeople.length > 0 && availablePeople.every((person) => selectedSet.has(person.id))

  function togglePerson(personId) {
    setSelectedIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId])
  }

  function toggleVisible() {
    const visibleIds = availablePeople.map((person) => person.id)
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((current) => [...new Set([...current, ...visibleIds])])
    }
  }

  return (
    <Modal title="Thêm thành viên vào kỳ" onClose={onClose}>
      <form className="form period-member-picker" onSubmit={(event) => {
        event.preventDefault()
        if (!submitting && selectedIds.length > 0) void onSubmit(selectedIds)
      }}>
        <div className="period-member-picker-toolbar">
          <label className="period-member-search">
            <span>Tìm người</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên, biệt danh, email, số điện thoại"
              autoFocus
            />
          </label>
          <div className="period-member-picker-actions">
            <button type="button" onClick={toggleVisible} disabled={availablePeople.length === 0}>
              {allVisibleSelected ? 'Bỏ chọn kết quả' : 'Chọn tất cả kết quả'}
            </button>
            <button type="button" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
              Bỏ chọn
            </button>
          </div>
        </div>

        <div className="period-member-picker-summary">
          <strong>{selectedIds.length} người đã chọn</strong>
          <span>{availablePeople.length} người phù hợp</span>
        </div>

        <div className="period-member-options">
          {availablePeople.length === 0 ? (
            <p className="period-member-picker-empty">
              {normalizedQuery ? 'Không tìm thấy người phù hợp.' : 'Tất cả người đang hoạt động đã có trong kỳ.'}
            </p>
          ) : availablePeople.map((person) => {
            const checked = selectedSet.has(person.id)
            return (
              <label key={person.id} className={`period-member-option${checked ? ' selected' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => togglePerson(person.id)} />
                <span className="period-member-option-copy">
                  <strong>{person.full_name}</strong>
                  <small>{person.nickname || person.email || person.phone || 'Chưa có thông tin liên hệ'}</small>
                </span>
                <StatusBadge value={person.attendance_type || 'guest'} />
              </label>
            )
          })}
        </div>

        <footer className="modal-actions">
          <button type="button" onClick={onClose} disabled={submitting}>Hủy</button>
          <button type="submit" disabled={submitting || selectedIds.length === 0}>
            {submitting ? 'Đang thêm...' : `Thêm ${selectedIds.length > 0 ? `${selectedIds.length} ` : ''}người`}
          </button>
        </footer>
      </form>
    </Modal>
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
        <p className="hint">Trước khi chia cầu cần thu hết nợ cũ. Đóng kỳ sau khi đã chia cầu và quỹ về 0; nợ tiền cầu mới phát sinh được giữ lại. Cần đóng kỳ đang mở trước khi mở kỳ tiếp theo.</p>
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
  const [discount, setDiscount] = useState(member.shuttle_discount_percent ?? (member.exempt_shuttle ? 100 : 0))
  const locked = member.shuttle_settled

  return (
    <Modal title="Sửa thành viên trong kỳ" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSubmit({ status, shuttle_discount_percent: discount }) }}>
        <label>Trạng thái
          <select value={status} disabled={locked} onChange={(e) => setStatus(e.target.value)}>
            <option value="fixed">Đánh cố định</option>
            <option value="guest">Đánh vãng lai</option>
            <option value="inactive">Tạm nghỉ</option>
          </select>
        </label>
        {status === 'fixed' && (
          <label>Miễn tiền cầu cuối kỳ
            <select value={discount} disabled={locked} onChange={(e) => setDiscount(Number(e.target.value))}>
              <option value={0}>Không miễn (0%)</option>
              <option value={50}>Miễn 50%</option>
              <option value={100}>Miễn hoàn toàn (100%)</option>
            </select>
          </label>
        )}
        <p className="hint">{locked
          ? 'Kỳ đã chốt chia cầu, mức miễn và trạng thái đã được khóa.'
          : 'Không miễn tính 1 suất, miễn 50% tính nửa suất, miễn 100% tính 0 suất. Chia tiền cầu theo tổng số suất; tiền đã ứng được ghi nhận đầy đủ.'}</p>
        <footer className="modal-actions">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit">Lưu thay đổi</button>
        </footer>
      </form>
    </Modal>
  )
}

export default PeriodsPanel
