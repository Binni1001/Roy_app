import { Suspense, lazy, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
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

  if (session === undefined) return <AppLoading />

  if (recoveringPassword || window.location.pathname.startsWith('/reset-password')) {
    return <ResetPassword />
  }

  if (!session) return <Login />

  const role = getSessionRole(session)

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (canOpenAdmin(role)) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<AppLoading />}>
          <AdminPortal session={session} role={role} onSignOut={signOut} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoading />}>
        <UserPortal session={session} role={role} onSignOut={signOut} />
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
