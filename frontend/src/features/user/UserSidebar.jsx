import { AccountBox, BrandBlock } from '../../components/shell'
import { userTabs } from '../../constants/appConstants'
import { initials } from '../../utils/appUtils'

export function UserSidebar({ activeTab, setActiveTab, activePerson, session, role, onSignOut, isOpen, onClose, pkBadge = 0 }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`user-sidebar${isOpen ? ' sidebar--open' : ''}`}>
        <BrandBlock caption="Roy Badminton" />
        <AccountBox session={session} role={role} onSignOut={onSignOut} showRole={false} />
        <div className="profile-card">
          {activePerson?.avatar_url
            ? <img src={activePerson.avatar_url} alt={activePerson.full_name} className="avatar avatar-img" />
            : <span className="avatar">{initials(activePerson?.full_name)}</span>
          }
          <strong>{activePerson?.full_name || 'Chọn người dùng'}</strong>
          <small>{activePerson?.nickname || activePerson?.phone || ''}</small>
        </div>
        <nav>
          {userTabs.map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? 'active' : ''}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {key === 'pk' && pkBadge > 0 && (
                <span className="pk-nav-badge">{pkBadge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-deco">
          <img src="/images/heart-shuttle.jpg" alt="" />
          <div className="sidebar-deco-text">
            <span className="sidebar-deco-club">🏸 Roy Badminton</span>
            <span className="sidebar-deco-motto">Chơi đẹp · Sống khoẻ</span>
          </div>
        </div>
      </aside>
    </>
  )
}
