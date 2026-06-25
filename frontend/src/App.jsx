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

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
    }).catch(() => {
      if (mounted) setSession(null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession ?? null)
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Fetch person record whenever we have a valid session
  useEffect(() => {
    if (!session) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerson(undefined)
    api.people.me().then((data) => {
      setPerson(data ?? null)
    }).catch(() => {
      setPerson(null)
    })
  }, [session])

  if (session === undefined) return <AppLoading />

  if (recoveringPassword || window.location.pathname.startsWith('/reset-password')) {
    return <ResetPassword />
  }

  if (!session) return <Login />

  // Still loading person record
  if (person === undefined) return <AppLoading />

  const refresh = () => setPerson(undefined)
  const role = getSessionRole(session)

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Admin/owner bypass toàn bộ group check — vào thẳng portal
  if (canOpenAdmin(role)) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<AppLoading />}>
          <AdminPortal session={session} role={role} onSignOut={signOut} person={person} onSwitchGroup={refresh} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  // User thường: kiểm tra group membership
  if (person === null) {
    return <Onboarding needsProfile onDone={refresh} />
  }

  if (!person.active_group_id) {
    return <Onboarding needsProfile={false} onDone={refresh} />
  }

  if (person.status === 'pending') {
    return <PendingApproval onRefresh={refresh} />
  }

  if (person.status === 'inactive') {
    return <RejectedScreen />
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
