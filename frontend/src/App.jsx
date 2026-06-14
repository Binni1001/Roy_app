import { useEffect, useState } from 'react'
import { AdminPortal } from './features/admin/AdminPortal'
import { UserPortal } from './features/user/UserPortal'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import { canOpenAdmin, getSessionRole } from './utils/appUtils'
import './App.css'

function App() {
  // undefined = đang khởi tạo, null = chưa đăng nhập, object = đã đăng nhập
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
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Đang tải session → màn hình chờ, không flash Login hay portal
  if (session === undefined) {
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

  if (recoveringPassword || window.location.pathname.startsWith('/reset-password')) {
    return <ResetPassword />
  }

  if (!session) return <Login />

  const role = getSessionRole(session)

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Không dùng path-based routing để tránh blank screen từ replaceState
  if (canOpenAdmin(role)) {
    return <AdminPortal session={session} role={role} onSignOut={signOut} />
  }

  return <UserPortal session={session} role={role} onSignOut={signOut} />
}

export default App
