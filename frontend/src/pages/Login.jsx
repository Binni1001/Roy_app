import { useEffect, useState } from 'react'
import logoUrl from '../assets/logo.png'
import { supabase } from '../lib/supabase'
import '../App.css'

const emptyForm = {
  username: '',
  email: '',
  password: '',
}

const resetCooldownSeconds = 90
const resetCooldownKey = 'roy_reset_password_available_at'

function readResetAvailableAt() {
  return Number(window.localStorage.getItem(resetCooldownKey) || 0)
}

function getCooldownLeft() {
  return Math.max(0, Math.ceil((readResetAvailableAt() - Date.now()) / 1000))
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(getCooldownLeft)

  useEffect(() => {
    if (resetCooldown <= 0) return undefined
    const timer = window.setInterval(() => setResetCooldown(getCooldownLeft()), 1000)
    return () => window.clearInterval(timer)
  }, [resetCooldown])

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function setResetCooldownWindow() {
    window.localStorage.setItem(
      resetCooldownKey,
      String(Date.now() + resetCooldownSeconds * 1000),
    )
    setResetCooldown(resetCooldownSeconds)
  }

  async function loginWithGoogle() {
    if (loading) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href,
      },
    })

    if (error) {
      console.error(error)
      setMessage('Đăng nhập Google thất bại. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  async function loginWithPassword(event) {
    event.preventDefault()
    if (loading) return
    setMessage('')
    setLoading(true)

    const identifier = form.email.trim()
    if (!identifier.includes('@')) {
      setMessage('Hiện tại vui lòng đăng nhập bằng email. Tên đăng nhập sẽ được dùng ở bước hồ sơ.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password: form.password,
    })

    if (error) {
      console.error(error)
      setMessage('Thông tin đăng nhập chưa đúng. Vui lòng kiểm tra lại.')
      setLoading(false)
      return
    }

    setMessage('Đăng nhập thành công.')
    setLoading(false)
  }

  async function registerWithPassword(event) {
    event.preventDefault()
    if (loading) return
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          username: form.username.trim(),
        },
        emailRedirectTo: window.location.href,
      },
    })

    if (error) {
      console.error(error)
      setMessage('Đăng ký thất bại. Vui lòng kiểm tra email và mật khẩu.')
      setLoading(false)
      return
    }

    setMessage('Đã tạo tài khoản. Nếu Supabase yêu cầu xác nhận email, vui lòng kiểm tra hộp thư.')
    setLoading(false)
  }

  async function sendResetEmail() {
    if (loading) return
    setMessage('')

    const cooldownLeft = getCooldownLeft()
    if (cooldownLeft > 0) {
      setResetCooldown(cooldownLeft)
      setMessage(`Vui lòng chờ ${cooldownLeft} giây trước khi gửi lại email đổi mật khẩu.`)
      return
    }

    const email = form.email.trim()
    if (!email || !email.includes('@')) {
      setMessage('Vui lòng nhập email để nhận liên kết đổi mật khẩu.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setResetCooldownWindow()

    if (error) {
      console.error(error)
      if (error.status === 429 || error.message?.includes('rate limit')) {
        setMessage('Bạn đã gửi email quá nhanh. Vui lòng chờ một lúc rồi thử lại.')
      } else {
        setMessage('Không gửi được email đổi mật khẩu. Vui lòng thử lại.')
      }
      setLoading(false)
      return
    }

    setMessage('Đã gửi email đổi mật khẩu. Vui lòng kiểm tra hộp thư.')
    setLoading(false)
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="login-logo">
            <img src={logoUrl} alt="Biểu trưng Roy Badminton" />
          </div>
          <p className="eyebrow">Roy Badminton</p>
          <h1>Chào mừng trở lại</h1>
          <p className="muted">
            Đăng nhập để theo dõi công nợ, thanh toán và quản lý quỹ câu lạc bộ.
          </p>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Đăng nhập
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Đăng ký
            </button>
          </div>

          {message && <div className="login-message" role="alert">{message}</div>}

          <form
            className="login-form"
            onSubmit={mode === 'login' ? loginWithPassword : registerWithPassword}
          >
            {mode === 'register' && (
              <label>
                Tên người dùng
                <input
                  value={form.username}
                  onChange={(event) => updateForm('username', event.target.value)}
                  placeholder="Ví dụ: duongtk"
                  required
                />
              </label>
            )}

            <label>
              {mode === 'login' ? 'Tên đăng nhập hoặc email' : 'Email'}
              <input
                type="text"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                placeholder="you@gmail.com"
                required
              />
            </label>

            <label>
              Mật khẩu
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => updateForm('password', event.target.value)}
                  placeholder="Nhập mật khẩu"
                  minLength={6}
                  required
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </span>
            </label>

            <button className="primary-auth-button" disabled={loading}>
              {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                className="text-button"
                onClick={sendResetEmail}
                disabled={loading || resetCooldown > 0}
              >
                {resetCooldown > 0
                  ? `Gửi lại sau ${resetCooldown} giây`
                  : 'Quên mật khẩu?'}
              </button>
            )}
          </form>

          <div className="login-divider"><span>hoặc</span></div>

          <button className="google-button" onClick={loginWithGoogle} disabled={loading}>
            Tiếp tục bằng Google
          </button>
        </div>
      </section>
    </main>
  )
}
