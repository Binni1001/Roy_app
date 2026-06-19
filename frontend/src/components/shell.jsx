import logoUrl from '../assets/logo.png'
import { displayRole, initials } from '../utils/appUtils'

export function BrandBlock({ caption }) {
  return (
    <div className="brand">
      <BrandLogo />
      <div>
        <strong>Roy Badminton</strong>
        <small>{caption}</small>
      </div>
    </div>
  )
}

export function BrandLogo() {
  return (
    <span className="brand-mark">
      <img src={logoUrl} alt="Biểu trưng Roy Badminton" />
    </span>
  )
}

export function AccountBox({ session, role, onSignOut, showRole = true }) {
  return (
    <div className="account-box">
      <span>{session?.user?.email || 'Tài khoản Google'}</span>
      {showRole && <small>Quyền: {displayRole(role)}</small>}
      <button onClick={onSignOut}>Đăng xuất</button>
    </div>
  )
}

export function Topbar({ eyebrow, title, loading, onRefresh, periodValue, periods, onPeriodChange, onMenuToggle, avatarPerson, children, notificationBell }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        {onMenuToggle && (
          <button className="hamburger" onClick={onMenuToggle} aria-label="Mở menu">
            {avatarPerson ? (
              avatarPerson.avatar_url
                ? <img src={avatarPerson.avatar_url} alt={avatarPerson.full_name} className="hamburger-avatar" />
                : <span className="hamburger-initials">{initials(avatarPerson.full_name)}</span>
            ) : (
              <><span /><span /><span /></>
            )}
          </button>
        )}
        <div className="topbar-title-text">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        {notificationBell && (
          <div className="topbar-bell-mobile">{notificationBell}</div>
        )}
      </div>
      <div className="toolbar">
        {children}
        {notificationBell && (
          <div className="topbar-bell-desktop">{notificationBell}</div>
        )}
        <select value={periodValue} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="">Chọn kỳ</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>{period.name}</option>
          ))}
        </select>
        <button onClick={onRefresh} disabled={loading}>Làm mới</button>
      </div>
    </header>
  )
}
