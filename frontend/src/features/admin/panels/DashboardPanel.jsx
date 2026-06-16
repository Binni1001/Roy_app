import { useState } from 'react'
import { api } from '../../../api/client'
import { ActionGroup, Input, Modal, Panel, SimpleTable } from '../../../components/common'
import { DebtTable, FundTable } from '../../../components/finance'
import { displayRole } from '../../../utils/appUtils'

export function DashboardPanel({ summary, debts, fund, role, adminUsers, adminUserForm, setForm, submit }) {
  const [showInvite, setShowInvite] = useState(false)

  return (
    <>
      <section className="metrics">
        {summary.map((item) => (
          <article className="metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>
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
