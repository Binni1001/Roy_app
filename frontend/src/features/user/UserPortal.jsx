import { useState } from 'react'
import { StatusLine } from '../../components/common'
import { NotificationBell } from '../../components/NotificationBell'
import { Topbar } from '../../components/shell'
import { useNotificationCenter } from '../../hooks/useNotificationCenter'
import { MemberHero } from './MemberHero'
import { PkArena } from './PkArena'
import { ProfileEdit } from './ProfileEdit'
import { ProfileSetup } from './ProfileSetup'
import { UserContent } from './UserContent'
import { UserBottomNav } from './UserBottomNav'
import { UserSidebar } from './UserSidebar'
import { useUserPortalData } from './useUserPortalData'

export function UserPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('user_tab') || 'home')
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

  const { notifications, unreadCount, markAllRead, dismiss } = useNotificationCenter(activePerson)

  const pkBadge = notifications.filter((n) => !n.read && n.action === 'pk').length

  function handleNotifAction(action) {
    if (action === 'pk') {
      setActiveTab('pk')
      sessionStorage.setItem('user_tab', 'pk')
      if (window.innerWidth <= 860) setSidebarOpen(false)
    } else if (action === 'home') {
      setActiveTab('home')
      sessionStorage.setItem('user_tab', 'home')
    }
  }

  return (
    <div className={`user-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <UserSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); sessionStorage.setItem('user_tab', tab); if (window.innerWidth <= 860) setSidebarOpen(false) }}
        activePerson={activePerson}
        session={session}
        role={role}
        onSignOut={onSignOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pkBadge={pkBadge}
      />
      <UserBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); sessionStorage.setItem('user_tab', tab) }}
        pkBadge={pkBadge}
        totalDebt={totalDebt}
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
          notificationBell={
            activePerson && (
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
                onDismiss={dismiss}
                onAction={handleNotifAction}
              />
            )
          }
        />
        <StatusLine text={toast} />

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
