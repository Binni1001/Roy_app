import { userTabs } from '../../constants/appConstants'

const TAB_ICONS = {
  home:     '🏠',
  profile:  '👤',
  schedule: '📅',
  pk:       '⚔️',
  debts:    '💸',
  history:  '📜',
  payment:  '💳',
}

export function UserBottomNav({ activeTab, setActiveTab, pkBadge = 0, totalDebt = 0 }) {
  // Show only the most important tabs in the bottom bar (max 5)
  const primary = ['home', 'schedule', 'pk', 'debts', 'profile']
  const visibleTabs = userTabs.filter(([key]) => primary.includes(key))

  return (
    <nav className="bottom-nav">
      {visibleTabs.map(([key, label]) => (
        <button
          key={key}
          className={`bottom-nav-item${activeTab === key ? ' active' : ''}`}
          onClick={() => setActiveTab(key)}
        >
          <span className="bottom-nav-icon">
            {TAB_ICONS[key] || '•'}
            {key === 'pk' && pkBadge > 0 && (
              <span className="bottom-nav-badge">{pkBadge}</span>
            )}
            {key === 'debts' && totalDebt > 0 && (
              <span className="bottom-nav-badge bottom-nav-badge-debt" />
            )}
          </span>
          <span className="bottom-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
