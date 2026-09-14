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
        <h1 className="invite-title">Tài khoản chưa được phép hoạt động</h1>
        <p className="invite-sub">
          Tài khoản đã nghỉ hoặc chưa được duyệt. Bạn không thể sử dụng các chức năng trong lúc này.
        </p>
        <p className="pending-hint">
          Liên hệ quản trị viên đang hoạt động để được kích hoạt lại. Quy định này áp dụng cả quản trị viên và chủ sở hữu.
        </p>

        <button className="invite-signout" onClick={handleSignOut}>
          Đăng xuất
        </button>
      </section>
    </main>
  )
}
