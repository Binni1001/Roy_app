import { useEffect, useState } from 'react'
import { AdminPortal } from './features/admin/AdminPortal'
import { UserPortal } from './features/user/UserPortal'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import { canOpenAdmin, getSessionRole } from './utils/appUtils'
import './App.css'

function RedirectTo({ to }) {
  useEffect(() => {
    window.history.replaceState({}, '', to)
  }, [to])

  return null
}

function App() {
  const [session, setSession] = useState(null)
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  const path = window.location.pathname

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    }).catch((error) => {
      console.error(error)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true)
        window.history.replaceState({}, '', '/reset-password')
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (path.startsWith('/reset-password') || recoveringPassword) return <ResetPassword />
  if (!session) return <Login />

  const role = getSessionRole(session)

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (canOpenAdmin(role)) {
    if (!path.startsWith('/admin')) return <RedirectTo to="/admin" />
    return <AdminPortal session={session} role={role} onSignOut={signOut} />
  }

  if (!path.startsWith('/user')) return <RedirectTo to="/user" />
  return <UserPortal session={session} role={role} onSignOut={signOut} />
}


export default App
