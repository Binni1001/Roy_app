import { Modal } from '../../../components/common'
import { initials } from '../../../utils/appUtils'

const TIERS = {
  diamond: { icon: '💠', label: 'Kim cương' },
  platinum: { icon: '💎', label: 'Bạch kim' },
  gold: { icon: '🥇', label: 'Vàng' },
  silver: { icon: '🥈', label: 'Bạc' },
  bronze: { icon: '🥉', label: 'Đồng' },
}

function TierBadge({ tierKey }) {
  const tier = TIERS[tierKey] || TIERS.bronze
  return <span className="lb-tier-badge" title={tier.label}>{tier.icon} <span className="lb-tier-name">{tier.label}</span></span>
}

function PersonIdentity({ row }) {
  return (
    <div className="pk-person-cell">
      {row.avatar_url
        ? <img src={row.avatar_url} className="avatar avatar-img pk-avatar" alt={row.full_name} />
        : <span className="avatar pk-avatar">{initials(row.full_name)}</span>}
      <span>
        {row.full_name}
        {row.attendance_type === 'guest' && <small className="lb-guest-tag">Vãng lai</small>}
      </span>
    </div>
  )
}

export function LeaderboardRow({ row, isMe }) {
  return (
    <tr className={isMe ? 'pk-row-me' : ''}>
      <td><span className="lb-rank-num">{row.rank}</span></td>
      <td><PersonIdentity row={row} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td><TierBadge tierKey={row.tier_key} /></td>
      <td className="lb-points"><strong>{Number(row.points || 0).toLocaleString('vi-VN')}</strong></td>
    </tr>
  )
}

export function QualifyingPlayers({ rows, activePersonId }) {
  if (!rows?.length) return null
  return (
    <div className="lb-qualifying">
      <h3>Đang hoàn thành điều kiện xếp hạng</h3>
      <div className="lb-qualifying-list">
        {rows.map((row) => (
          <div key={row.id} className={row.id === activePersonId ? 'lb-qualifying-row pk-row-me' : 'lb-qualifying-row'}>
            <PersonIdentity row={row} />
            <span className="muted">
              {row.matches_needed > 0 && `Cần thêm ${row.matches_needed} trận`}
              {row.matches_needed > 0 && row.opponents_needed > 0 && ' · '}
              {row.opponents_needed > 0 && `Cần gặp thêm ${row.opponents_needed} đối thủ`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LeaderboardLegend({ onShowGuide }) {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item">💠 Kim cương</span>
      <span className="lb-legend-item">💎 Bạch kim</span>
      <span className="lb-legend-item">🥇 Vàng</span>
      <span className="lb-legend-item">🥈 Bạc</span>
      <span className="lb-legend-item">🥉 Đồng</span>
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">Điểm Elo thay đổi theo sức mạnh đối thủ và đặt lại ở mỗi kỳ.</span>
      <button className="lb-guide-btn" onClick={onShowGuide}>Cách xếp hạng</button>
    </div>
  )
}

export function RankingGuideModal({ onClose }) {
  return (
    <Modal title="Cách xếp hạng đấu trường" onClose={onClose}>
      <div className="rg-root">
        <p className="rg-intro">
          Mỗi kỳ là một mùa độc lập. Hệ thống tính điểm Elo theo thứ tự trận đã hoàn tất,
          kết quả trận và sức mạnh đối thủ. Điểm hiển thị được làm tròn để dễ theo dõi.
        </p>
        <div className="rg-quote">
          Thắng đối thủ mạnh giúp tăng hạng nhiều hơn; thua đối thủ yếu ảnh hưởng nhiều hơn.
        </div>

        <p className="rg-section-title">Điều kiện xuất hiện trên bảng</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">①</span><span>Hoàn tất ít nhất <strong>5 trận</strong> trong kỳ.</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">②</span><span>Thi đấu với ít nhất <strong>3 đối thủ khác nhau</strong>.</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">③</span><span>Đánh đơn và đánh đôi có bảng xếp hạng riêng.</span></div>
        </div>

        <p className="rg-section-title">Các bậc thi đấu</p>
        <div className="rg-rules">
          {Object.values(TIERS).map((tier) => (
            <div className="rg-rule" key={tier.label}>
              <span className="rg-rule-icon">{tier.icon}</span><span><strong>{tier.label}</strong></span>
            </div>
          ))}
        </div>

        <div className="rg-footer">
          Khi kết quả được xác nhận, người chơi và tỷ số bị khóa ngay. Owner chỉ có thể hủy kết quả
          có ghi lý do; hệ thống sau đó tự tính lại toàn bộ các trận tiếp theo trong kỳ.
        </div>
      </div>
    </Modal>
  )
}
