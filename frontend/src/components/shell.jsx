import logoUrl from '../assets/logo.png'
import { displayRole } from '../utils/appUtils'

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

export function AccountBox({ session, role, onSignOut }) {
  return (
    <div className="account-box">
      <span>{session?.user?.email || 'Tài khoản Google'}</span>
      <small>Quyền: {displayRole(role)}</small>
      <button onClick={onSignOut}>Đăng xuất</button>
    </div>
  )
}

export function Topbar({ eyebrow, title, loading, onRefresh, periodValue, periods, onPeriodChange, children }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="toolbar">
        {children}
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
