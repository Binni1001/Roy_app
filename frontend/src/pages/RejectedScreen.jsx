import logoUrl from '../assets/logo.png'
import { supabase } from '../lib/supabase'

export default function RejectedScreen() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <main className="login-page">
      <section className="invite-panel">
        <div className="invite-logo">
          <img src={logoUrl} alt="Roy Badminton" />
        </div>

        <div className="rejected-icon">🚫</div>
        <h1 className="invite-title">Tài khoản bị từ chối</h1>
        <p className="invite-sub">
          Yêu cầu của bạn đã bị từ chối hoặc tài khoản đã bị vô hiệu hóa.
        </p>
        <p className="pending-hint">
          Liên hệ trưởng nhóm nếu bạn cho rằng đây là nhầm lẫn.
        </p>

        <button className="invite-signout" onClick={handleSignOut}>
          Đăng xuất
        </button>
      </section>
    </main>
  )
}
