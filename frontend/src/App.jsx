import { Suspense, lazy, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { supabase } from './lib/supabase'
import { api } from './api/client'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import PendingApproval from './pages/PendingApproval'
import RejectedScreen from './pages/RejectedScreen'
import { canOpenAdmin, getSessionRole } from './utils/appUtils'
import { GROUPS_ENABLED } from './config/features'
import './App.css'

const AdminPortal = lazy(() => import('./features/admin/AdminPortal'))
const UserPortal  = lazy(() => import('./features/user/UserPortal'))

function AppLoading() {
  return (
    <div className="app-loading">
      <img src="/images/cat-loading.png" alt="Đang tải" className="app-loading-img" />
      <div className="app-loading-dots">
        <span className="app-loading-dot" />
        <span className="app-loading-dot" />
        <span className="app-loading-dot" />
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(undefined)
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  // undefined = loading, null = no record, object = person data
  const [person, setPerson] = useState(undefined)
  // tick tăng lên mỗi lần cần re-fetch person (dùng để trigger useEffect)
  const [personTick, setPersonTick] = useState(0)
  // admin/owner: true khi đang mở màn hình thêm nhóm
  const [addingGroup, setAddingGroup] = useState(false)

  useEffect(() => {
    let mounted = true

    // Chỉ đổi session state khi user hoặc role tin cậy thay đổi.
    // Bỏ qua TOKEN_REFRESHED / SIGNED_IN / INITIAL_SESSION nếu cả hai không đổi
    // — các sự kiện này fire khi quay lại tab, nếu set lại sẽ tạo
    // object session mới → remount portal → màn hình loading nhấp nháy.
    const applySession = (nextSession) => {
      if (!mounted) return
      setSession((prev) => {
        if (prev === undefined) return nextSession ?? null
        const prevId = prev?.user?.id ?? null
        const nextId = nextSession?.user?.id ?? null
        if (prevId === nextId && getSessionRole(prev) === getSessionRole(nextSession)) return prev
        return nextSession ?? null
      })
    }

    supabase.auth.getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => applySession(null))

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true)
      applySession(nextSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Fetch person record khi user id thay đổi hoặc khi cần refresh (personTick).
  // Dùng userId (chuỗi) thay vì object session để token refresh không trigger.
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!userId) return
    const onInactive = () => setPerson({ status: 'inactive' })
    const checkStatus = () => {
      if (document.visibilityState !== 'visible') return
      api.people.me().then((data) => setPerson(data ?? null)).catch(() => {})
    }
    window.addEventListener('roy:account-inactive', onInactive)
    window.addEventListener('focus', checkStatus)
    const timer = window.setInterval(checkStatus, 30000)
    return () => {
      window.removeEventListener('roy:account-inactive', onInactive)
      window.removeEventListener('focus', checkStatus)
      window.clearInterval(timer)
    }
  }, [userId])
  useEffect(() => {
    if (!userId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerson(undefined)
    let mounted = true
    api.people.me().then((data) => {
      if (mounted) setPerson(data ?? null)
    }).catch((error) => {
      if (mounted) setPerson(error.cause?.response?.data?.code === 'ACCOUNT_INACTIVE'
        ? { status: 'inactive' } : null)
    })
    return () => { mounted = false }
  }, [userId, personTick])

  if (session === undefined) return <AppLoading />

  if (recoveringPassword || window.location.pathname.startsWith('/reset-password')) {
    return <ResetPassword />
  }

  if (!session) return <Login />

  // Still loading person record
  if (person === undefined) return <AppLoading />

  const refresh = () => { setAddingGroup(false); setPersonTick(t => t + 1) }
  const role = getSessionRole(session)

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (person?.status === 'inactive') return <RejectedScreen />

  // Admin/owner bypass toàn bộ group check — vào thẳng portal
  // Ngoại trừ khi đang mở màn hình thêm nhóm
  if (canOpenAdmin(role)) {
    if (addingGroup) {
      return <Onboarding needsProfile={!person} canCreate onDone={refresh} onCancel={() => setAddingGroup(false)} />
    }
    return (
      <ErrorBoundary>
        <Suspense fallback={<AppLoading />}>
          <AdminPortal session={session} role={role} onSignOut={signOut} person={person} onSwitchGroup={() => setAddingGroup(true)} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  // User thường: kiểm tra group membership
  if (person === null) {
    return <Onboarding needsProfile canCreate={false} onDone={refresh} />
  }

  // Người đã nghỉ luôn bị chặn (dù bật hay tắt tính năng nhóm)
  if (person.status === 'inactive') {
    return <RejectedScreen />
  }

  const membershipStatus = person.membership_status || person.status
  if (membershipStatus === 'pending') {
    return <PendingApproval onRefresh={refresh} />
  }

  // Các chốt chặn theo nhóm (chưa có nhóm / chờ duyệt) chỉ áp dụng khi BẬT nhóm.
  // Khi tắt nhóm: ai có hồ sơ là vào thẳng, không cần duyệt.
  if (GROUPS_ENABLED) {
    if (!person.active_group_id) {
      return <Onboarding needsProfile={false} canCreate={false} onDone={refresh} />
    }
    if (membershipStatus !== 'active') {
      return <RejectedScreen />
    }
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoading />}>
        <UserPortal session={session} role={role} onSignOut={signOut} onSwitchGroup={refresh} />
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
