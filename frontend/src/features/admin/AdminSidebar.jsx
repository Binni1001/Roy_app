import { BarChart2, CalendarDays, DollarSign, LayoutDashboard, LogOut, Swords, Users, Wallet, Wind, Zap } from 'lucide-react'
import { BrandLogo } from '../../components/shell'
import { displayRole } from '../../utils/appUtils'

const ADMIN_NAV = [
  ['dashboard', 'Tổng quan',  'Bức tranh chung',       LayoutDashboard],
  ['analytics', 'Thống kê',   'Báo cáo chi tiết',      BarChart2],
  ['people',    'Nhân sự',    'Người trong câu lạc bộ', Users],
  ['periods',   'Kỳ quỹ',    'Kỳ sinh hoạt',           CalendarDays],
  ['sessions',  'Buổi cầu',  'Lịch đã ghi nhận',       Zap],
  ['shuttle',   'Chi cầu',   'Mua và chia cầu',         Wind],
  ['debts',     'Công nợ',   'Khoản cần thu',           Wallet],
  ['fund',      'Sổ quỹ',    'Thu chi câu lạc bộ',      DollarSign],
  ['pk',        'Đấu trường','Quản lý kèo PK',          Swords],
]

export function AdminSidebar({ activeTab, setActiveTab, session, role, onSignOut, isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>

        {/* ── Brand ── */}
        <div className="sb-brand">
          <BrandLogo />
          <div className="sb-brand-name">Roy Badminton</div>
        </div>

        {/* ── Account info compact ── */}
        <div className="sb-account">
          <span className="sb-account-email">{session?.user?.email}</span>
          <span className="sb-account-role">{displayRole(role)}</span>
        </div>

        {/* ── Nav ── */}
        <nav className="sb-nav">
          {ADMIN_NAV.map(([key, label, hint, Icon]) => (
            <button
              key={key}
              className={`sb-nav-item${activeTab === key ? ' active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={17} strokeWidth={2} />
              <div className="sb-nav-text">
                <span>{label}</span>
                <small>{hint}</small>
              </div>
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
