import { AccountBox, BrandBlock } from '../../components/shell'
import { adminTabs } from '../../constants/appConstants'

export function AdminSidebar({ activeTab, setActiveTab, session, role, onSignOut, isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
        <BrandBlock caption="Quản lý quỹ câu lạc bộ" />
        <AccountBox session={session} role={role} onSignOut={onSignOut} />
        <nav>
          {adminTabs.map(([key, label, hint]) => (
            <button
              key={key}
              className={activeTab === key ? 'active' : ''}
              onClick={() => setActiveTab(key)}
            >
              <span>{label}</span>
              <small>{hint}</small>
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
