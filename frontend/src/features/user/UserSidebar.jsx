import { AccountBox, BrandBlock } from '../../components/shell'
import { userTabs } from '../../constants/appConstants'
import { initials } from '../../utils/appUtils'

export function UserSidebar({ activeTab, setActiveTab, activePerson, session, role, onSignOut, isOpen, onClose }) {
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
            </button>
          ))}
        </nav>
        <div className="sidebar-deco">
          <img src="/images/rackets-court.jpg" alt="" />
        </div>
      </aside>
    </>
  )
}
