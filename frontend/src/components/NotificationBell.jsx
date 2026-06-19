import { useEffect, useRef, useState } from 'react'

const ACTION_LABEL = {
  pk:   '→ Đấu trường',
  home: '→ Trang chủ',
}

function timeAgo(date) {
  const sec = Math.floor((Date.now() - new Date(date)) / 1000)
  if (sec < 60) return 'Vừa xong'
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`
  if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`
  return `${Math.floor(sec / 86400)} ngày trước`
}

export function NotificationBell({ notifications, unreadCount, onMarkAllRead, onDismiss, onAction }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleAction(notif) {
    onAction(notif.action)
    setOpen(false)
  }

  return (
    <div className="nb-wrap" ref={ref}>
      <button
        className={`nb-bell${unreadCount > 0 ? ' nb-has-unread' : ''}`}
        onClick={() => { setOpen((v) => !v); if (!open && unreadCount > 0) onMarkAllRead() }}
        aria-label="Thông báo"
      >
        🔔
        {unreadCount > 0 && (
          <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="nb-dropdown">
          <div className="nb-header">
            <span className="nb-header-title">Thông báo</span>
            {notifications.length > 0 && (
              <button className="nb-clear-all" onClick={() => { onMarkAllRead() }}>Đánh dấu đọc tất</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="nb-empty">
              <span className="nb-empty-icon">🎉</span>
              <p>Không có thông báo mới</p>
            </div>
          ) : (
            <ul className="nb-list">
              {notifications.map((n) => (
                <li key={n.id} className={`nb-item${n.read ? ' nb-read' : ' nb-unread'}`}>
                  <span className="nb-icon">{n.icon}</span>
                  <div className="nb-content">
                    <strong className="nb-title">{n.title}</strong>
                    {n.body && <p className="nb-body">{n.body}</p>}
                    <div className="nb-meta">
                      <span className="nb-time">{timeAgo(n.at)}</span>
                      {n.action && (
                        <button className="nb-action-link" onClick={() => handleAction(n)}>
                          {ACTION_LABEL[n.action] || '→ Xem'}
                        </button>
                      )}
                    </div>
                  </div>
                  <button className="nb-dismiss" onClick={() => onDismiss(n.id)} title="Xóa">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
