import { Modal } from '../../../components/common'
import { SeasonTierBadge, SeasonTierGuide } from '../../../components/SeasonTierBadge'
import { SeasonAchievementMarks } from '../../../components/SeasonAchievements'
import { initials } from '../../../utils/appUtils'

function PersonIdentity({ row, achievements }) {
  return (
    <div className="pk-person-cell">
      {row.avatar_url
        ? <img src={row.avatar_url} className="avatar avatar-img pk-avatar" alt={row.full_name} />
        : <span className="avatar pk-avatar">{initials(row.full_name)}</span>}
      <span>
        <span className="pk-person-name">{row.full_name}</span>
        {row.attendance_type === 'guest' && <small className="lb-guest-tag">Vãng lai</small>}
        <SeasonAchievementMarks personId={row.id} achievements={achievements} />
      </span>
    </div>
  )
}

export function LeaderboardRow({ row, isMe, achievements }) {
  const rowClasses = [isMe && 'pk-row-me', row.tier_key === 'champion' && 'lb-row-champion'].filter(Boolean).join(' ')

  return (
    <tr className={rowClasses}>
      <td><span className="lb-rank-num">{row.rank}</span></td>
      <td><PersonIdentity row={row} achievements={achievements} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td><SeasonTierBadge tierKey={row.tier_key} showLabel={false} /></td>
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

export function RankingGuideModal({ onClose }) {
  return (
    <Modal title="Cách xếp hạng đấu trường" onClose={onClose}>
      <div className="rg-root">
        <p className="rg-intro">
          Mỗi kỳ là một mùa độc lập. Thắng trận giúp tăng điểm, thua trận làm giảm điểm.
          Điểm càng cao thì thứ hạng càng cao.
        </p>
        <div className="rg-quote">
          Thắng đối thủ mạnh được cộng nhiều điểm hơn; thua đối thủ yếu bị trừ nhiều điểm hơn.
        </div>

        <p className="rg-section-title">Điều kiện xuất hiện trên bảng</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">①</span><span>Hoàn tất ít nhất <strong>5 trận</strong> trong kỳ.</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">②</span><span>Thi đấu với ít nhất <strong>3 đối thủ khác nhau</strong>.</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">③</span><span>Đánh đơn và đánh đôi có bảng xếp hạng riêng.</span></div>
        </div>

        <p className="rg-section-title">Các bậc theo vị trí trong mùa</p>
        <SeasonTierGuide />

        <div className="rg-quote">
          Hạng 1 đạt bậc Cao thủ. Bậc của những người còn lại phụ thuộc vào vị trí trong mùa và có thể thay đổi khi xuất hiện kết quả mới.
        </div>

        <p className="rg-section-title">Vinh danh mùa</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">⚡</span><span><strong>Năng nổ:</strong> hoàn tất 8 trận trong ít nhất 3 ngày khác nhau.</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🔥</span><span><strong>Chuỗi thắng:</strong> đang thắng liên tiếp từ 3 trận.</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🏆</span><span><strong>Chơi nhiều nhất:</strong> có tổng số trận cao nhất mùa; bằng nhau sẽ cùng được vinh danh.</span></div>
        </div>

        <div className="rg-footer">
          Khi kết quả được xác nhận, người chơi và tỷ số bị khóa ngay. Owner chỉ có thể hủy kết quả
          có ghi lý do; hệ thống sau đó tự tính lại toàn bộ các trận tiếp theo trong kỳ.
        </div>
      </div>
    </Modal>
  )
}
