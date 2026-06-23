import { useRef, useState } from 'react'
import { Input, Panel } from '../../components/common'
import { initials } from '../../utils/appUtils'

export function ProfileEdit({ activePerson, submitting, onSave }) {
  const [form, setForm] = useState({
    full_name: activePerson?.full_name || '',
    nickname: activePerson?.nickname || '',
    phone: activePerson?.phone || '',
    bio: activePerson?.bio || '',
    birthday: activePerson?.birthday || '',
    gender: activePerson?.gender || '',
    attendance_type: activePerson?.attendance_type || 'fixed',
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(activePerson?.avatar_url || null)
  const fileInputRef = useRef(null)

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh không được vượt quá 2MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave(form, avatarFile)
  }

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/racket-sky.jpg)' }}>
      <section className="grid one">
        <Panel title="Sửa hồ sơ của tôi">
          <form className="form profile-edit" onSubmit={handleSubmit}>

            {/* Avatar */}
            <div className="avatar-upload-row">
              <div
                className="avatar-upload-preview"
                onClick={() => fileInputRef.current?.click()}
                title="Nhấn để đổi ảnh"
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Avatar" />
                  : <span className="avatar large">{initials(form.full_name || activePerson?.full_name)}</span>
                }
                <div className="avatar-upload-overlay">
                  <span>Đổi ảnh</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={handleAvatarChange}
              />
              <div className="avatar-upload-hint">
                <p className="eyebrow">Ảnh đại diện</p>
                <small className="muted">JPG, PNG, tối đa 2MB. Nhấn vào ảnh để thay đổi.</small>
                {avatarFile && <small className="muted">Đã chọn: {avatarFile.name}</small>}
              </div>
            </div>

            <div className="form-grid-two">
              <Input
                label="Họ và tên *"
                value={form.full_name}
                onChange={(v) => updateField('full_name', v)}
                required
              />
              <Input
                label="Biệt danh"
                value={form.nickname}
                onChange={(v) => updateField('nickname', v)}
              />
              <Input
                label="Số điện thoại"
                value={form.phone}
                onChange={(v) => updateField('phone', v)}
              />
              <Input
                label="Ngày sinh"
                type="date"
                value={form.birthday}
                onChange={(v) => updateField('birthday', v)}
              />
              <label>
                Giới tính
                <select value={form.gender} onChange={(e) => updateField('gender', e.target.value)}>
                  <option value="">Không muốn tiết lộ</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </label>
              <label>
                Hình thức chơi
                <select value={form.attendance_type} onChange={(e) => updateField('attendance_type', e.target.value)}>
                  <option value="fixed">Đánh cố định</option>
                  <option value="guest">Đánh vãng lai</option>
                </select>
              </label>
            </div>

            <label>
              Giới thiệu bản thân
              <textarea
                value={form.bio}
                onChange={(e) => updateField('bio', e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Chia sẻ đôi điều về bản thân..."
              />
              <span style={{ fontSize: 11, color: form.bio.length > 450 ? '#ff8c8c' : '#6a748a', alignSelf: 'flex-end' }}>
                {form.bio.length}/500
              </span>
            </label>

            <div className="profile-readonly">
              <p className="eyebrow">Email đăng nhập</p>
              <p className="muted">{activePerson?.email}</p>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </Panel>
      </section>
    </div>
  )
}
