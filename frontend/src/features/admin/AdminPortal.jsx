import { useState } from 'react'
import { StatusLine } from '../../components/common'
import { Topbar } from '../../components/shell'
import { AdminContent } from './AdminContent'
import { AdminSidebar } from './AdminSidebar'
import { useAdminPortalData } from './useAdminPortalData'

export function AdminPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 860)
  const {
    activePeriod,
    adminUsers,
    boot,
    checkout,
    createPayment,
    data,
    forms,
    loading,
    submitting,
    people,
    periods,
    selectedPeriodId,
    selectedPersonId,
    setForm,
    setSelectedPeriodId,
    setSelectedPersonId,
    submit,
    summary,
    toast,
  } = useAdminPortalData(role)

  return (
    <div className={`admin-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); if (window.innerWidth <= 860) setSidebarOpen(false) }}
        session={session}
        role={role}
        onSignOut={onSignOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="workspace admin-workspace" style={{ backgroundImage: 'url(/images/player-jump2.jpg)' }}>
        <Topbar
          eyebrow="Khu quản trị"
          title={activePeriod?.name || 'Chưa có kỳ'}
          loading={loading}
          onRefresh={boot}
          periodValue={selectedPeriodId}
          periods={periods}
          onPeriodChange={setSelectedPeriodId}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        <StatusLine text={toast} />
        <AdminContent
          activeTab={activeTab}
          summary={summary}
          people={people}
          periods={periods}
          data={data}
          forms={forms}
          setForm={setForm}
          selectedPeriodId={selectedPeriodId}
          selectedPersonId={selectedPersonId}
          setSelectedPersonId={setSelectedPersonId}
          submit={submit}
          submitting={submitting}
          createPayment={createPayment}
          checkout={checkout}
          role={role}
          adminUsers={adminUsers}
        />
      </main>
    </div>
  )
}

