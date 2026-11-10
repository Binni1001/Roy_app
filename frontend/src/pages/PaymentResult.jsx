import logoUrl from '../assets/logo.png'
import { getPaymentResultKind } from '../utils/paymentResult'

const COPY = {
  cancelled: {
    icon: '↩️',
    title: 'Bạn đã hủy thanh toán',
    text: 'Chưa có khoản tiền nào bị trừ. Bạn có thể quay lại ứng dụng và tạo lại lệnh thanh toán khi sẵn sàng.'
  },
  returned: {
    icon: '⏳',
    title: 'Đang xác nhận thanh toán',
    text: 'PayOS sẽ báo kết quả cho hệ thống trong ít giây. Công nợ chỉ được ghi nhận đã trả khi hệ thống nhận được xác nhận đó, nên hãy mở lại ứng dụng để xem trạng thái mới nhất.'
  }
}

export default function PaymentResult() {
  const kind = getPaymentResultKind(window.location.pathname, window.location.search)
  const copy = COPY[kind]

  return (
    <main className="login-page">
      <section className="invite-panel">
        <div className="invite-logo">
          <img src={logoUrl} alt="Roy Badminton" />
        </div>
        <div className="rejected-icon">{copy.icon}</div>
        <h1 className="invite-title">{copy.title}</h1>
        <p className="invite-sub">{copy.text}</p>
        <button className="invite-signout" onClick={() => window.location.assign('/')}>
          Quay lại ứng dụng
        </button>
      </section>
    </main>
  )
}
