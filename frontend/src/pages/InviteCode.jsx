import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import { api } from '../api/client'
import { supabase } from '../lib/supabase'

export default function InviteCode({ needsProfile, onJoined }) {
  const [step, setStep] = useState(1)           // 1 = nhập mã, 2 = nhập tên
  const [code, setCode] = useState('')
  const [groupName, setGroupName] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleVerifyCode(e) {
    e.preventDefault()
    if (!code.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      const result = await api.groups.verifyCode(code.trim().toUpperCase())
      setGroupName(result.group_name)
      if (needsProfile) {
        setStep(2)
      } else {
        // Has existing profile, just join
        await api.groups.join(code.trim().toUpperCase())
        onJoined()
      }
    } catch (err) {
      setError(err.message || 'Mã nhóm không đúng.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!fullName.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      await api.groups.join(code.trim().toUpperCase(), fullName.trim())
      onJoined()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra. Thử lại.')
    } finally {
      setLoading(false)
    }
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

        {step === 1 && (
          <>
            <h1 className="invite-title">Tham gia nhóm</h1>
            <p className="invite-sub">Nhập mã nhóm do trưởng nhóm cung cấp</p>

            <form className="invite-form" onSubmit={handleVerifyCode}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: DEMO-CLUB"
                maxLength={12}
                required
                autoFocus
                className="invite-input"
              />
              {error && <p className="invite-error">{error}</p>}
              <button type="submit" disabled={loading} className="invite-btn">
                {loading ? 'Đang kiểm tra...' : 'Tiếp theo'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="invite-group-name">Nhóm: <strong>{groupName}</strong></div>
            <h1 className="invite-title">Tạo hồ sơ</h1>
            <p className="invite-sub">Nhập tên của bạn để hoàn tất đăng ký</p>

            <form className="invite-form" onSubmit={handleJoin}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Họ và tên"
                maxLength={80}
                required
                autoFocus
                className="invite-input"
              />
              {error && <p className="invite-error">{error}</p>}
              <button type="submit" disabled={loading} className="invite-btn">
                {loading ? 'Đang gửi...' : 'Gửi yêu cầu tham gia'}
              </button>
              <button type="button" className="invite-back" onClick={() => { setStep(1); setError('') }}>
                ← Nhập lại mã
              </button>
            </form>
          </>
        )}

        <button className="invite-signout" onClick={handleSignOut}>
          Đăng xuất
        </button>
      </section>
    </main>
  )
}
