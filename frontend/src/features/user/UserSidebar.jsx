import { AccountBox, BrandBlock } from '../../components/shell'
import { userTabs } from '../../constants/appConstants'
import { initials } from '../../utils/appUtils'

export function UserSidebar({ activeTab, setActiveTab, activePerson, session, role, onSignOut }) {
  return (
    <aside className="user-sidebar">
      <BrandBlock caption="Khu người dùng" />
      <AccountBox session={session} role={role} onSignOut={onSignOut} />
      <div className="profile-card">
        <span className="avatar">{initials(activePerson?.full_name)}</span>
        <strong>{activePerson?.full_name || 'Chọn người dùng'}</strong>
        <small>{activePerson?.phone || 'Chưa có số điện thoại'}</small>
      </div>
      <nav>
        {userTabs.map(([key, label]) => (
          <button
            key={key}
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
