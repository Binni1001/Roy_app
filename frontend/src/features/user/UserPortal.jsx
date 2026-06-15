import { useState } from 'react'
import { StatusLine } from '../../components/common'
import { Topbar } from '../../components/shell'
import { usePkNotifications } from '../../hooks/usePkNotifications'
import { MemberHero } from './MemberHero'
import { PkArena } from './PkArena'
import { PkNotificationToast } from './PkNotificationToast'
import { ProfileEdit } from './ProfileEdit'
import { ProfileSetup } from './ProfileSetup'
import { UserContent } from './UserContent'
import { UserSidebar } from './UserSidebar'
import { useUserPortalData } from './useUserPortalData'

export function UserPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 860)

  const {
    activePerson,
    attendanceType,
    boot,
    checkout,
    createPayment,
    createProfile,
    updateProfile,
    data,
    loading,
    submitting,
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

  const { notifications, dismiss, dismissAll } = usePkNotifications(activePerson)

  return (
    <div className={`user-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <UserSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); if (window.innerWidth <= 860) setSidebarOpen(false) }}
        activePerson={activePerson}
        session={session}
        role={role}
        onSignOut={onSignOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pkBadge={notifications.length}
      />
      <main className="workspace user-workspace">
        <Topbar
          eyebrow=""
          title={activePerson?.full_name || 'Tài khoản cầu lông'}
          loading={loading}
          onRefresh={boot}
          periodValue={selectedPeriodId}
          periods={periods}
          onPeriodChange={setSelectedPeriodId}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          avatarPerson={activePerson}
        />
        <StatusLine text={toast} />

        <PkNotificationToast
          notifications={notifications}
          onDismiss={dismiss}
          onDismissAll={dismissAll}
          onGoToPk={() => {
            setActiveTab('pk')
            dismissAll()
            if (window.innerWidth <= 860) setSidebarOpen(false)
          }}
        />

        {loading && !activePerson ? null : !activePerson ? (
          <ProfileSetup
            form={profileForm}
            setForm={setProfileForm}
            loading={submitting}
            email={session.user.email}
            onSubmit={createProfile}
          />
        ) : activeTab === 'profile' ? (
          <ProfileEdit
            activePerson={activePerson}
            submitting={submitting}
            onSave={updateProfile}
          />
        ) : activeTab === 'pk' ? (
          <PkArena activePerson={activePerson} />
        ) : (
          <>
            <MemberHero
              activePerson={activePerson}
              attendanceType={attendanceType}
              balance={data.balance?.balance}
              loading={submitting}
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
