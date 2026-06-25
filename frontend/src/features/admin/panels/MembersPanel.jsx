import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../api/client'

function Avatar({ person }) {
  if (person.avatar_url) {
    return <img src={person.avatar_url} alt={person.full_name} className="members-panel-avatar" />
  }
  const initials = (person.full_name || '?').charAt(0).toUpperCase()
  return <span className="members-panel-avatar members-panel-avatar--initials">{initials}</span>
}

function PendingCard({ person, onApprove, onReject, busy }) {
  return (
    <div className="members-panel-card">
      <Avatar person={person} />
      <div className="members-panel-info">
        <p className="members-panel-name">{person.full_name}</p>
        {person.nickname && <p className="members-panel-nick">@{person.nickname}</p>}
        <p className="members-panel-email">{person.email}</p>
        <p className="members-panel-date">Đăng ký: {new Date(person.created_at).toLocaleDateString('vi-VN')}</p>
      </div>
      <div className="members-panel-actions">
        <button
          className="btn-primary members-panel-approve"
          onClick={() => onApprove(person.id)}
          disabled={busy}
        >
          Duyệt
        </button>
        <button
          className="btn-danger members-panel-reject"
          onClick={() => onReject(person.id)}
          disabled={busy}
        >
          Từ chối
        </button>
      </div>
    </div>
  )
}

export default function MembersPanel({ role }) {
  const [pending, setPending] = useState([])
  const [groupInfo, setGroupInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, infoRes] = await Promise.all([
        role === 'owner' ? api.groups.pending() : Promise.resolve([]),
        api.groups.info(),
      ])
      setPending(pendingRes || [])
      setGroupInfo(infoRes)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [role])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function handleApprove(personId) {
    setBusy(true)
    try {
      await api.groups.approve(personId)
      notify('Đã duyệt thành viên.')
      setPending((p) => p.filter((x) => x.id !== personId))
    } catch (err) {
      notify(err.message || 'Lỗi khi duyệt.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReject(personId) {
    if (!window.confirm('Từ chối thành viên này?')) return
    setBusy(true)
    try {
      await api.groups.reject(personId)
      notify('Đã từ chối thành viên.')
      setPending((p) => p.filter((x) => x.id !== personId))
    } catch (err) {
      notify(err.message || 'Lỗi khi từ chối.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('Tạo mã nhóm mới? Mã cũ sẽ không còn hiệu lực.')) return
    setBusy(true)
    try {
      const res = await api.groups.regenerateCode()
      setGroupInfo((g) => ({ ...g, invite_code: res.invite_code }))
      notify(`Mã mới: ${res.invite_code}`)
    } catch (err) {
      notify(err.message || 'Lỗi khi tạo mã mới.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel members-panel">
      <h2 className="panel-title">Quản lý thành viên</h2>

      {toast && <div className="members-panel-toast">{toast}</div>}

      {/* Thông tin nhóm + mã mời */}
      <section className="members-panel-section">
        <h3 className="members-panel-section-title">Mã mời nhóm</h3>
        {loading ? (
          <p className="members-panel-empty">Đang tải...</p>
        ) : groupInfo ? (
          <div className="members-panel-group-box">
            <div className="members-panel-group-name">{groupInfo.name}</div>
            <div className="members-panel-code-row">
              <span className="members-panel-code">{groupInfo.invite_code}</span>
              <button
                className="btn-secondary members-panel-regen"
                onClick={handleRegenerate}
                disabled={busy}
              >
                Tạo mã mới
              </button>
            </div>
            <p className="members-panel-code-hint">
              Chia sẻ mã này cho thành viên mới để họ có thể tham gia nhóm.
            </p>
          </div>
        ) : (
          <p className="members-panel-empty">Không lấy được thông tin nhóm.</p>
        )}
      </section>

      {/* Danh sách chờ duyệt — chỉ owner */}
      {role === 'owner' && (
        <section className="members-panel-section">
          <h3 className="members-panel-section-title">
            Chờ duyệt
            {pending.length > 0 && <span className="members-panel-badge">{pending.length}</span>}
          </h3>
          {loading ? (
            <p className="members-panel-empty">Đang tải...</p>
          ) : pending.length === 0 ? (
            <p className="members-panel-empty">Không có thành viên nào chờ duyệt.</p>
          ) : (
            <div className="members-panel-list">
              {pending.map((p) => (
                <PendingCard
                  key={p.id}
                  person={p}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={busy}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
