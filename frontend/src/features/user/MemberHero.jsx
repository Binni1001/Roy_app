import { formatMoney, initials } from '../../utils/appUtils'

export function MemberHero({
  activePerson,
  attendanceType,
  balance,
  loading,
  totalDebt,
  onCreatePayment,
  onUpdateAttendanceType,
}) {
  return (
    <section className="member-hero">
      <div>
        <span className="avatar large">{initials(activePerson?.full_name)}</span>
        <div className="membership-toggle">
          <button
            className={attendanceType === 'fixed' ? 'active' : ''}
            onClick={() => onUpdateAttendanceType('fixed')}
            disabled={loading}
          >
            Đánh cố định
          </button>
          <button
            className={attendanceType === 'guest' ? 'active' : ''}
            onClick={() => onUpdateAttendanceType('guest')}
            disabled={loading}
          >
            Đánh vãng lai
          </button>
        </div>
        <p className="eyebrow">Số dư hiện tại</p>
        <strong>{formatMoney(balance || 0)}</strong>
        <small>
          {attendanceType === 'fixed'
            ? 'Bạn đang xem theo diện cố định tháng này.'
            : 'Bạn đang xem theo diện vãng lai tháng này.'}
        </small>
      </div>
      <div>
        <p>Nợ cần thanh toán</p>
        <strong>{formatMoney(totalDebt)}</strong>
        <button onClick={onCreatePayment} disabled={loading || !activePerson}>
          Thanh toán qua PayOS
        </button>
      </div>
    </section>
  )
}
