import { Input } from '../../components/common'

const FEATURES = [
  { icon: '💰', title: 'Theo dõi công nợ', desc: 'Biết chính xác bạn nợ bao nhiêu mỗi kỳ' },
  { icon: '📅', title: 'Lịch chơi', desc: 'Xem lịch buổi đánh và ngày cầu đã dùng' },
  { icon: '⚔️', title: 'Đấu trường PK', desc: 'Thách đấu và theo dõi bảng xếp hạng' },
  { icon: '💳', title: 'Thanh toán online', desc: 'Nộp tiền qua PayOS nhanh chóng' },
]

export function ProfileSetup({ form, setForm, loading, email, onSubmit }) {
  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="onboarding-wrap">
      {/* Hero banner */}
      <div className="onboarding-hero">
        <img src="/images/racket-sky.jpg" alt="" className="onboarding-hero-img" />
        <div className="onboarding-hero-overlay" />
        <div className="onboarding-hero-content">
          <div className="onboarding-logo-ring">🏸</div>
          <h1 className="onboarding-title">Chào mừng đến Roy Badminton!</h1>
          <p className="onboarding-subtitle">
            Tạo hồ sơ để bắt đầu theo dõi công nợ, lịch chơi và đấu trường của bạn
          </p>
        </div>
      </div>

      {/* Features grid */}
      <div className="onboarding-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="onboarding-feature-item">
            <span className="onboarding-feature-icon">{f.icon}</span>
            <div>
              <strong className="onboarding-feature-title">{f.title}</strong>
              <p className="onboarding-feature-desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Form card */}
      <div className="onboarding-form-card">
        <div className="onboarding-step-badge">Bước 1 / 1</div>
        <h2 className="onboarding-form-title">Hoàn thiện hồ sơ</h2>
        <p className="onboarding-form-hint">
          Tài khoản <span className="onboarding-email">{email}</span> chưa có hồ sơ trong câu lạc bộ.
        </p>

        <form className="form onboarding-form" onSubmit={onSubmit}>
          <Input
            label="Họ và tên *"
            value={form.full_name}
            onChange={(value) => updateField('full_name', value)}
            required
          />
          <Input
            label="Số điện thoại"
            value={form.phone}
            onChange={(value) => updateField('phone', value)}
          />
          <label>
            Hình thức chơi
            <select
              value={form.attendance_type}
              onChange={(event) => updateField('attendance_type', event.target.value)}
            >
              <option value="fixed">Đánh cố định (thành viên tháng)</option>
              <option value="guest">Đánh vãng lai (tính theo buổi)</option>
            </select>
          </label>
          <button className="onboarding-submit-btn" disabled={loading}>
            {loading ? 'Đang tạo hồ sơ…' : '🚀 Tạo hồ sơ và bắt đầu'}
          </button>
        </form>
      </div>
    </div>
  )
}
