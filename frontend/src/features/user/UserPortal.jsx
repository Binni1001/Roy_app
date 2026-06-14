import { useState } from 'react'
import { StatusLine } from '../../components/common'
import { Topbar } from '../../components/shell'
import { MemberHero } from './MemberHero'
import { ProfileSetup } from './ProfileSetup'
import { UserContent } from './UserContent'
import { UserSidebar } from './UserSidebar'
import { useUserPortalData } from './useUserPortalData'

export function UserPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const {
    activePerson,
    attendanceType,
    boot,
    checkout,
    createPayment,
    createProfile,
    data,
    loading,
    periods,
    profileForm,
    selectedPeriodId,
    setProfileForm,
    setSelectedPeriodId,
    toast,
    totalDebt,
    unpaidDebts,
    updateAttendanceType,
  } = useUserPortalData(session, setActiveTab)

  return (
    <div className="user-shell">
      <UserSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false) }}
        activePerson={activePerson}
        session={session}
        role={role}
        onSignOut={onSignOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="workspace user-workspace">
        <Topbar
          eyebrow="Khu người dùng"
          title={activePerson?.full_name || 'Tài khoản cầu lông'}
          loading={loading}
          onRefresh={boot}
          periodValue={selectedPeriodId}
          periods={periods}
          onPeriodChange={setSelectedPeriodId}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        <StatusLine text={toast} />
        {!activePerson ? (
          <ProfileSetup
            form={profileForm}
            setForm={setProfileForm}
            loading={loading}
            email={session.user.email}
            onSubmit={createProfile}
          />
        ) : (
          <>
            <MemberHero
              activePerson={activePerson}
              attendanceType={attendanceType}
              balance={data.balance?.balance}
              loading={loading}
              totalDebt={totalDebt}
              onCreatePayment={createPayment}
              onUpdateAttendanceType={updateAttendanceType}
            />
            <UserContent
              activeTab={activeTab}
              debts={data.debts}
              unpaidDebts={unpaidDebts}
              transactions={data.transactions}
              sessions={data.sessions}
              checkout={checkout}
            />
          </>
        )}
      </main>
    </div>
  )
}
