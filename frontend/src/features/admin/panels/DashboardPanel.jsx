import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, Input, Modal, Panel, SimpleTable } from '../../../components/common'
import { DebtTable, FundTable } from '../../../components/finance'
import { displayRole, formatMoney, initials } from '../../../utils/appUtils'

export function DashboardPanel({ summary, debts, fund, members, sessions, shuttleExpenses, role, adminUsers, adminUserForm, setForm, submit }) {
  const [showInvite, setShowInvite] = useState(false)

  const fixedMembers = members.filter((m) => m.status === 'fixed')
  const memberPaymentStatus = fixedMembers.map((m) => {
    const debt = debts.find((d) => d.person_id === m.person_id && d.debt_type === 'monthly_fee')
    return { ...m, monthlyDebt: debt || null }
  })
  const paidCount   = memberPaymentStatus.filter((m) => m.monthlyDebt?.status === 'paid').length
  const unpaidCount = memberPaymentStatus.filter((m) => m.monthlyDebt?.status === 'unpaid').length

  const totalShuttleCost = shuttleExpenses.reduce((s, e) => s + Number(e.total_amount || 0), 0)
  const totalShuttleUsed = sessions.reduce((s, e) => s + Number(e.shuttle_used_count || 0), 0)

  return (
    <>
      <p className="metrics-section-label">Tổng quan dự án</p>
      <section className="metrics">
        {summary.map((item) => (
          <article className="metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <p className="metrics-section-label">Kỳ hiện tại</p>
      <section className="metrics" style={{ marginTop: 0 }}>
        <article className="metric">
          <span>Buổi trong kỳ</span>
          <strong>{sessions.length}</strong>
        </article>
        <article className="metric">
          <span>Cầu đã dùng</span>
          <strong>{totalShuttleUsed} quả</strong>
        </article>
        <article className="metric">
          <span>Chi phí cầu</span>
          <strong>{formatMoney(totalShuttleCost)}</strong>
        </article>
        <article className="metric">
          <span>Thành viên cố định</span>
          <strong>{fixedMembers.length} người</strong>
        </article>
      </section>

      {/* Tình trạng đóng tiền tháng */}
      {fixedMembers.length > 0 && (
        <section className="grid one" style={{ marginBottom: 0 }}>
          <Panel title={`Tình trạng đóng tiền tháng — ${paidCount}/${fixedMembers.length} đã đóng`}>
            <div className="dash-member-grid">
              {memberPaymentStatus.map((m) => {
                const status = m.monthlyDebt?.status
                const cls = status === 'paid' ? 'dash-member-paid'
                  : status === 'unpaid' ? 'dash-member-unpaid'
                  : 'dash-member-none'
                const label = status === 'paid' ? '✓ Đã đóng'
                  : status === 'unpaid' ? '✗ Chưa đóng'
                  : '— Chưa có nợ'
                return (
                  <div key={m.id} className={`dash-member-card ${cls}`}>
                    {m.person?.avatar_url
                      ? <img src={m.person.avatar_url} alt="" className="dash-member-avatar" />
                      : <span className="avatar dash-member-avatar">{initials(m.person?.full_name)}</span>
                    }
                    <span className="dash-member-name">{m.person?.full_name}</span>
                    <span className="dash-member-status">{label}</span>
                    {status === 'unpaid' && m.monthlyDebt?.amount && (
                      <span className="dash-member-amount">{formatMoney(m.monthlyDebt.amount)}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {unpaidCount > 0 && (
              <p style={{ marginTop: 10, fontSize: 13, color: '#ff8c8c' }}>
                ⚠️ Còn {unpaidCount} thành viên chưa đóng tiền tháng
              </p>
            )}
          </Panel>
        </section>
      )}

      <section className="grid two">
        <Panel title="Công nợ gần đây"><DebtTable debts={debts.slice(0, 8)} /></Panel>
        <Panel title="Giao dịch quỹ"><FundTable rows={fund.slice(0, 8)} /></Panel>
      </section>

      {role === 'owner' && (
        <section className="grid one owner-tools">
          <Panel
            title="Danh sách quản trị viên"
            action={<button onClick={() => setShowInvite(true)}>+ Mời quản trị viên</button>}
          >
            <SimpleTable
              rows={adminUsers}
              columns={[['email', 'Thư điện tử'], ['role', 'Quyền', displayRole], ['full_name', 'Tên hiển thị']]}
              actions={(user) =>
                user.role !== 'owner' ? (
                  <ActionGroup>
                    <button
                      className="danger"
                      onClick={() => submit(() => api.adminUsers.revoke(user.id), 'Đã thu hồi quyền quản trị viên.')}
                    >
                      Thu hồi
                    </button>
                  </ActionGroup>
                ) : null
              }
            />
          </Panel>
        </section>
      )}

      {showInvite && (
        <Modal title="Mời quản trị viên" onClose={() => setShowInvite(false)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault()
            submit(() => api.adminUsers.invite(adminUserForm), 'Đã gửi lời mời hoặc gắn quyền quản trị viên.')
            setForm('adminUser', { email: '', full_name: '' })
            setShowInvite(false)
          }}>
            <Input label="Thư điện tử quản trị viên" value={adminUserForm.email} onChange={(v) => setForm('adminUser', { email: v })} required />
            <Input label="Tên hiển thị" value={adminUserForm.full_name} onChange={(v) => setForm('adminUser', { full_name: v })} />
            <footer className="modal-actions">
              <button type="button" onClick={() => setShowInvite(false)}>Hủy</button>
              <button type="submit">Mời làm quản trị viên</button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  )
}

export default DashboardPanel
