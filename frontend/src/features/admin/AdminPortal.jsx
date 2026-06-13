import { useState } from 'react'
import { StatusLine } from '../../components/common'
import { Topbar } from '../../components/shell'
import { AdminContent } from './AdminContent'
import { AdminSidebar } from './AdminSidebar'
import { useAdminPortalData } from './useAdminPortalData'

export function AdminPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const {
    activePeriod,
    adminUsers,
    boot,
    checkout,
    createPayment,
    data,
    forms,
    loading,
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
    <div className="admin-shell">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        role={role}
        onSignOut={onSignOut}
      />
      <main className="workspace admin-workspace">
        <Topbar
          eyebrow="Khu quản trị"
          title={activePeriod?.name || 'Chưa có kỳ'}
          loading={loading}
          onRefresh={boot}
          periodValue={selectedPeriodId}
          periods={periods}
          onPeriodChange={setSelectedPeriodId}
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
          createPayment={createPayment}
          checkout={checkout}
          role={role}
          adminUsers={adminUsers}
        />
      </main>
    </div>
  )
}

