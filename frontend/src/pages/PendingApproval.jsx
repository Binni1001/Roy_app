import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import { supabase } from '../lib/supabase'

export default function PendingApproval({ onRefresh }) {
  const [checking, setChecking] = useState(false)

  async function handleRefresh() {
    setChecking(true)
    await onRefresh?.()
    setTimeout(() => setChecking(false), 1000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <main className="login-page">
      <section className="invite-panel">
        <div className="invite-logo">
          <img src={logoUrl} alt="Roy Badminton" />
        </div>

        <div className="pending-icon">⏳</div>
        <h1 className="invite-title">Đang chờ duyệt</h1>
        <p className="invite-sub">
          Yêu cầu tham gia nhóm của bạn đã được gửi đi.<br />
          Vui lòng chờ trưởng nhóm xác nhận.
        </p>
        <p className="pending-hint">Bạn sẽ được vào ngay sau khi trưởng nhóm duyệt.</p>

        <button className="invite-btn" onClick={handleRefresh} disabled={checking} style={{ marginTop: 8 }}>
          {checking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
        </button>

        <button className="invite-signout" onClick={handleSignOut}>Đăng xuất</button>
      </section>
    </main>
  )
}
