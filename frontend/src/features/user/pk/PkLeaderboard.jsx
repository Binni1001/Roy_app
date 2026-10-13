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

export function LeaderboardRow({ row, isMe, achievements, archived = false, fixedPoints = false }) {
  const rowClasses = [isMe && 'pk-row-me', row.tier_key === 'champion' && 'lb-row-champion'].filter(Boolean).join(' ')

  return (
    <tr className={rowClasses}>
      <td><span className="lb-rank-num">{row.rank}{row.tied_rank && <small> · cùng hạng</small>}</span></td>
      <td><PersonIdentity row={row} achievements={achievements} /></td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td>{fixedPoints ? row.score_difference : archived ? `${(Number(row.wilson_score) * 100).toFixed(2)}%` : <SeasonTierBadge tierKey={row.tier_key} showLabel={false} />}</td>
      {fixedPoints && <td title="Thắng–thua đối đầu trong nhóm cùng điểm và hiệu số">{row.head_to_head_applied ? `${row.head_to_head_wins}–${row.head_to_head_losses}` : '—'}</td>}
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
              {Number.isFinite(row.points) && <small> · {row.points} điểm · Hiệu số {row.score_difference}</small>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RankingGuideModal({ onClose, archived = false, fixedPoints = false }) {
  if (archived) return <Modal title="Cách xếp hạng kỳ tháng 6" onClose={onClose}>
    <div className="rg-root">
      <p>Bảng lịch sử được dựng lại từ 57 trận hoàn tất còn lưu bằng đúng công thức trên giao diện cũ.</p>
      <p>Xếp theo chỉ số Wilson (★) từ cao xuống thấp, sau đó số trận thắng. Điểm hiển thị = 3 × thắng − thua, tối thiểu 0.</p>
      <p>Kỳ này dùng luật cũ, không yêu cầu 5 trận / 3 đối thủ. Trường hợp hòa hoàn toàn giữ thứ tự hiển thị của hàm cũ.</p>
      <p className="muted">Bản dựng lại chưa được đối chiếu với ảnh hoặc backup bảng cuối mùa. Tên lấy từ hồ sơ lúc lưu bản khôi phục.</p>
    </div>
  </Modal>
  if (fixedPoints) return <Modal title="Cách xếp hạng +3/−2" onClose={onClose}>
    <div className="rg-root">
      <p>Mùa bắt đầu từ 0 điểm: thắng +3, thua −2. Không có hệ số cao ở 5 trận đầu hoặc trừ điểm nghỉ lâu. Điểm có thể âm.</p>
      <p>Không cần đủ 5 trận. Người đã có kết quả và gặp 3 đối thủ khác nhau được lên bảng. Đơn và đôi tính riêng.</p>
      <p>Ưu tiên điểm, rồi hiệu số tổng điểm cầu ghi được trừ bị ghi qua tất cả các set. Điểm và hiệu số đôi lưu riêng từng người, kể cả khi đổi đồng đội.</p>
      <p>Nếu còn hòa, xét thắng trừ thua trong các trận đối đầu giữa nhóm còn hòa. Đồng đội cùng bên không tính là đối đầu. Chỉ xét khi mọi cặp trong nhóm đã gặp nhau ở hai bên đối diện.</p>
      <p>Chưa phân được thì cùng hạng; mọi người tự bàn bạc phân hạng bên ngoài. Hệ thống không tự thêm trận phân hạng.</p>
    </div>
  </Modal>
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
