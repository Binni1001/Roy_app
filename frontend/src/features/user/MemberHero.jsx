import { formatMoney } from '../../utils/appUtils'

export function MemberHero({
  activePerson,
  attendanceType,
  balance,
  loading,
  totalDebt,
  onCreatePayment,
  onUpdateAttendanceType,
}) {
  const hasDebt = totalDebt > 0
  const balancePositive = (balance || 0) >= 0

  return (
    <section className="member-hero-v2">
      {/* Background image layer */}
      <div
        className="mh-bg"
        style={{ backgroundImage: 'url(/images/hero-action.jpg)' }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="mh-body">
        {/* Top row: greeting + toggle */}
        <div className="mh-top">
          <div className="mh-greeting">
            <span className="mh-greeting-label">Chào mừng trở lại 👋</span>
            <h2 className="mh-name">
              {activePerson
                ? activePerson.full_name
                : 'Thành viên'}
            </h2>
          </div>
          <div className="membership-toggle mh-toggle">
            <button
              className={attendanceType === 'fixed' ? 'active' : ''}
              onClick={() => onUpdateAttendanceType('fixed')}
              disabled={loading}
            >
              Cố định
            </button>
            <button
              className={attendanceType === 'guest' ? 'active' : ''}
              onClick={() => onUpdateAttendanceType('guest')}
              disabled={loading}
            >
              Vãng lai
            </button>
          </div>
        </div>

        {/* Stat cards row */}
        <div className="mh-stats">
          <div className="mh-stat-card">
            <span className="mh-stat-label">Số dư tài khoản</span>
            <strong className={`mh-stat-value ${balancePositive ? '' : 'mh-negative'}`}>
              {formatMoney(balance || 0)}
            </strong>
            <span className="mh-stat-hint">
              {attendanceType === 'fixed' ? 'Thành viên cố định' : 'Thành viên vãng lai'}
            </span>
          </div>

          <div className={`mh-stat-card mh-stat-debt ${hasDebt ? 'mh-debt-active' : ''}`}>
            <span className="mh-stat-label">Nợ cần thanh toán</span>
            <strong className={`mh-stat-value ${hasDebt ? 'mh-debt-value' : ''}`}>
              {formatMoney(totalDebt)}
            </strong>
            <button
              className="mh-pay-btn"
              onClick={onCreatePayment}
              disabled={loading || !activePerson || !hasDebt}
            >
              {hasDebt ? '💳 Thanh toán PayOS →' : '✓ Đã thanh toán'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
