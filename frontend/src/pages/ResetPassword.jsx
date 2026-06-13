import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import { supabase } from '../lib/supabase'
import '../App.css'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function updatePassword(event) {
    event.preventDefault()
    setMessage('')

    if (password.length < 6) {
      setMessage('Mật khẩu mới cần có ít nhất 6 ký tự.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Mật khẩu xác nhận chưa khớp.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error(error)
      setMessage('Không đổi được mật khẩu. Vui lòng mở lại liên kết trong email.')
      setLoading(false)
      return
    }

    setMessage('Đã đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.')
    setLoading(false)
  }

  return (
    <main className="login-page">
      <section className="login-panel reset-panel">
        <div className="login-brand">
          <div className="login-logo">
            <img src={logoUrl} alt="Biểu trưng Roy Badminton" />
          </div>
          <p className="eyebrow">Roy Badminton</p>
          <h1>Đổi mật khẩu</h1>
          <p className="muted">Nhập mật khẩu mới và xác nhận để hoàn tất bảo mật tài khoản.</p>
        </div>

        <form className="login-card login-form" onSubmit={updatePassword}>
          {message && <div className="login-message" role="alert">{message}</div>}

          <label>
            Mật khẩu mới
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu mới"
                minLength={6}
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          <label>
            Xác nhận mật khẩu
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                minLength={6}
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          <button className="primary-auth-button" disabled={loading}>
            Cập nhật mật khẩu
          </button>
        </form>
      </section>
    </main>
  )
}
