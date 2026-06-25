import { CalendarDays, History, Home, LogOut, Swords, User, UserPen, Wallet } from 'lucide-react'
import { BrandLogo } from '../../components/shell'
import { formatMoney, initials } from '../../utils/appUtils'

const USER_NAV = [
  ['home',     'Trang cá nhân', Home],
  ['profile',  'Sửa hồ sơ',    UserPen],
  ['schedule', 'Lịch đánh',    CalendarDays],
  ['pk',       'Đấu trường',   Swords],
  ['debts',    'Công nợ',      Wallet],
  ['history',  'Lịch sử',      History],
  ['payment',  'Thanh toán',   Wallet],
]

export function UserSidebar({ activeTab, setActiveTab, activePerson, session, role, onSignOut, isOpen, onClose, pkBadge = 0, totalDebt = 0 }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`user-sidebar${isOpen ? ' sidebar--open' : ''}`}>

        {/* ── Brand ── */}
        <div className="sb-brand">
          <BrandLogo />
          <div className="sb-brand-name">Roy Badminton</div>
        </div>

        {/* ── Profile card ── */}
        {activePerson && (
          <div className="sb-profile-card">
            {activePerson.avatar_url
              ? <img src={activePerson.avatar_url} alt={activePerson.full_name} className="sb-avatar sb-avatar-img" />
              : <span className="sb-avatar">{initials(activePerson.full_name)}</span>
            }
            <div className="sb-profile-info">
              <strong>{activePerson.full_name}</strong>
              <small>{activePerson.nickname || 'Thành viên'}</small>
              {totalDebt > 0 && (
                <span className="sb-profile-debt">Nợ: {formatMoney(totalDebt)}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Nav ── */}
        <nav className="sb-nav">
          {USER_NAV.map(([key, label, Icon]) => (
            <button
              key={key}
              className={`sb-nav-item${activeTab === key ? ' active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={17} strokeWidth={2} />
              <span>{label}</span>
              {key === 'pk' && pkBadge > 0 && (
                <span className="pk-nav-badge">{pkBadge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* ── Logout ── */}
        <button className="sb-logout" onClick={onSignOut}>
          <LogOut size={16} strokeWidth={2} />
          <span>Đăng xuất</span>
        </button>

      </aside>
    </>
  )
}
