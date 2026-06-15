const TYPE_CONFIG = {
  challenged: {
    icon: '⚔️',
    title: 'Bạn bị thách đấu!',
    color: '#d8ae52',
  },
  partnered: {
    icon: '🤝',
    title: 'Bạn được mời làm đồng đội!',
    color: '#64b5f6',
  },
  won: {
    icon: '🏆',
    title: 'Bạn đã thắng kèo!',
    color: '#4caf7d',
  },
  lost: {
    icon: '😔',
    title: 'Bạn đã thua kèo',
    color: '#e57373',
  },
}

export function PkNotificationToast({ notifications, onDismiss, onDismissAll, onGoToPk }) {
  if (!notifications.length) return null

  return (
    <div className="pk-notif-container">
      {notifications.length > 1 && (
        <div className="pk-notif-actions">
          <button className="pk-notif-dismiss-all" onClick={onDismissAll}>
            Đóng tất cả ({notifications.length})
          </button>
        </div>
      )}
      {notifications.map((n) => {
        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.challenged
        return (
          <div key={n.id} className="pk-notif-card" style={{ borderLeftColor: cfg.color }}>
            <span className="pk-notif-icon">{cfg.icon}</span>
            <div className="pk-notif-body">
              <strong>{cfg.title}</strong>
              <small>
                {n.matchType === 'singles' ? 'Đánh đơn' : 'Đánh đôi'}
                {n.betItems ? ` · Cược: ${n.betItems}` : ''}
              </small>
              <button className="pk-notif-goto" onClick={onGoToPk}>
                Xem ngay →
              </button>
            </div>
            <button className="pk-notif-close" onClick={() => onDismiss(n.id)}>×</button>
          </div>
        )
      })}
    </div>
  )
}
