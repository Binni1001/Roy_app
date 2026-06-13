import { api } from '../../../api/client'
import { Input, Panel, SimpleTable } from '../../../components/common'
import { DebtTable, FundTable } from '../../../components/finance'
import { displayRole } from '../../../utils/appUtils'

export function DashboardPanel({ summary, debts, fund, role, adminUsers, adminUserForm, setForm, submit }) {
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
        <section className="grid two owner-tools">
          <Panel title="Mời quản trị viên">
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault()
                submit(
                  () => api.adminUsers.invite(adminUserForm),
                  'Đã gửi lời mời hoặc gắn quyền quản trị viên.',
                )
                setForm('adminUser', { email: '', full_name: '' })
              }}
            >
              <Input label="Thư điện tử quản trị viên" value={adminUserForm.email} onChange={(value) => setForm('adminUser', { email: value })} required />
              <Input label="Tên hiển thị" value={adminUserForm.full_name} onChange={(value) => setForm('adminUser', { full_name: value })} />
              <button>Mời làm quản trị viên</button>
            </form>
          </Panel>
          <Panel title="Danh sách quản trị viên">
            <SimpleTable
              rows={adminUsers}
              columns={[['email', 'Thư điện tử'], ['role', 'Quyền', displayRole], ['full_name', 'Tên hiển thị']]}
            />
          </Panel>
        </section>
      )}
    </>
  )
}
