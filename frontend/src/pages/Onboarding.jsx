import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import { api } from '../api/client'
import { supabase } from '../lib/supabase'

// step: 'choose' | 'join-code' | 'join-name' | 'create-name'
export default function Onboarding({ needsProfile, onDone, canCreate = false, onCancel }) {
  const [step, setStep] = useState('choose')
  const [code, setCode] = useState('')
  const [groupName, setGroupName] = useState('')   // tên nhóm khi verify code thành công
  const [newGroupName, setNewGroupName] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function goTo(s) { setStep(s); setError('') }

  async function handleVerifyCode(e) {
    e.preventDefault()
    if (!code.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      const result = await api.groups.verifyCode(code.trim().toUpperCase())
      setGroupName(result.group_name)
      if (needsProfile) goTo('join-name')
      else {
        await api.groups.join(code.trim().toUpperCase())
        onDone()
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
      onDone()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newGroupName.trim() || loading) return
    if (needsProfile && !fullName.trim()) return
    setError('')
    setLoading(true)
    try {
      await api.groups.create(newGroupName.trim(), needsProfile ? fullName.trim() : undefined)
      onDone()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra.')
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

        {/* BƯỚC 1 — Chọn tạo hay tham gia */}
        {step === 'choose' && (
          <>
            <h1 className="invite-title">Bắt đầu</h1>
            {canCreate
              ? <p className="invite-sub">Bạn muốn tạo nhóm mới hay tham gia nhóm đã có?</p>
              : <p className="invite-sub">Nhập mã nhóm do quản trị viên cung cấp để tham gia</p>
            }
            <div className="onboarding-choices">
              {canCreate && (
                <button className="onboarding-choice" onClick={() => goTo('create-name')}>
                  <span className="onboarding-choice-icon">✦</span>
                  <span className="onboarding-choice-label">Tạo nhóm mới</span>
                  <span className="onboarding-choice-sub">Bạn sẽ là trưởng nhóm</span>
                </button>
              )}
              <button className="onboarding-choice" onClick={() => goTo('join-code')}>
                <span className="onboarding-choice-icon">⊕</span>
                <span className="onboarding-choice-label">Tham gia nhóm</span>
                <span className="onboarding-choice-sub">Nhập mã do quản trị viên cung cấp</span>
              </button>
            </div>
          </>
        )}

        {/* BƯỚC 2a — Nhập mã tham gia */}
        {step === 'join-code' && (
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
              <button type="button" className="invite-back" onClick={() => goTo('choose')}>← Quay lại</button>
            </form>
          </>
        )}

        {/* BƯỚC 2b — Nhập tên sau khi verify mã */}
        {step === 'join-name' && (
          <>
            <div className="invite-group-name">Nhóm: <strong>{groupName}</strong></div>
            <h1 className="invite-title">Tạo hồ sơ</h1>
            <p className="invite-sub">Nhập tên của bạn để gửi yêu cầu tham gia</p>
            <form className="invite-form" onSubmit={handleJoin}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Họ và tên"
                maxLength={80}
                required
                autoFocus
                className="invite-input"
                style={{ letterSpacing: 0, textTransform: 'none', fontSize: 15 }}
              />
              {error && <p className="invite-error">{error}</p>}
              <button type="submit" disabled={loading} className="invite-btn">
                {loading ? 'Đang gửi...' : 'Gửi yêu cầu tham gia'}
              </button>
              <button type="button" className="invite-back" onClick={() => goTo('join-code')}>← Nhập lại mã</button>
            </form>
          </>
        )}

        {/* BƯỚC 2c — Tạo nhóm mới */}
        {step === 'create-name' && (
          <>
            <h1 className="invite-title">Tạo nhóm mới</h1>
            <p className="invite-sub">Bạn sẽ là trưởng nhóm và nhận mã mời để chia sẻ</p>
            <form className="invite-form" onSubmit={handleCreate}>
              {needsProfile && (
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Họ và tên của bạn"
                  maxLength={80}
                  required
                  autoFocus
                  className="invite-input"
                  style={{ letterSpacing: 0, textTransform: 'none', fontSize: 15 }}
                />
              )}
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Tên nhóm (VD: Roy Badminton)"
                maxLength={80}
                required
                autoFocus={!needsProfile}
                className="invite-input"
                style={{ letterSpacing: 0, textTransform: 'none', fontSize: 15 }}
              />
              {error && <p className="invite-error">{error}</p>}
              <button type="submit" disabled={loading} className="invite-btn">
                {loading ? 'Đang tạo...' : 'Tạo nhóm'}
              </button>
              <button type="button" className="invite-back" onClick={() => goTo('choose')}>← Quay lại</button>
            </form>
          </>
        )}

        {onCancel
          ? <button className="invite-back" style={{ marginTop: 16 }} onClick={onCancel}>← Quay lại portal</button>
          : <button className="invite-signout" onClick={handleSignOut}>Đăng xuất</button>
        }
      </section>
    </main>
  )
}
