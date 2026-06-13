import { Input, Panel } from '../../components/common'

export function ProfileSetup({ form, setForm, loading, email, onSubmit }) {
  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="grid one">
      <Panel title="Hoàn thiện hồ sơ người chơi">
        <form className="form profile-setup" onSubmit={onSubmit}>
          <p className="muted">
            Tài khoản {email} chưa có hồ sơ trong câu lạc bộ. Vui lòng nhập thông tin để bắt đầu sử dụng khu người dùng.
          </p>
          <Input
            label="Họ tên"
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
              <option value="fixed">Đánh cố định</option>
              <option value="guest">Đánh vãng lai</option>
            </select>
          </label>
          <button disabled={loading}>Tạo hồ sơ</button>
        </form>
      </Panel>
    </section>
  )
}
