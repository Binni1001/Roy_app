import { Modal } from '../../../components/common'
import { initials } from '../../../utils/appUtils'

// Bậc kỹ năng theo rating
function TierBadge({ icon, label }) {
  return <span className="lb-tier-badge" title={label}>{icon} <span className="lb-tier-name">{label}</span></span>
}

export function LeaderboardRow({ row, isMe }) {
  return (
    <tr className={`${isMe ? 'pk-row-me' : ''} ${row.provisional ? 'lb-row-unqualified' : ''}`}>
      <td>{row.rank ? <span className="lb-rank-num">{row.rank}</span> : <span className="lb-rank-num muted">–</span>}</td>
      <td>
        <div className="pk-person-cell">
          {row.avatar_url
            ? <img src={row.avatar_url} className="avatar avatar-img pk-avatar" alt={row.full_name} />
            : <span className="avatar pk-avatar">{initials(row.full_name)}</span>}
          <span>
            {row.full_name}
            {row.is_guest && <small className="lb-guest-tag">Vãng lai</small>}
          </span>
        </div>
      </td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td><TierBadge icon={row.tier_icon} label={row.tier_label} /></td>
      <td className="lb-rating">
        <strong>{row.rating}</strong>
        {row.provisional && <small className="muted lb-prov"> tạm tính</small>}
      </td>
    </tr>
  )
}

export function LeaderboardLegend({ onShowGuide }) {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item">💎 Bạch kim</span>
      <span className="lb-legend-item">🥇 Vàng</span>
      <span className="lb-legend-item">🥈 Bạc</span>
      <span className="lb-legend-item">🥉 Đồng</span>
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">Rating <strong>Glicko</strong> — thắng người mạnh cộng nhiều; người mới hiện "tạm tính"</span>
      <button className="lb-guide-btn" onClick={onShowGuide}>❓ Cách xếp hạng</button>
    </div>
  )
}

export function RankingGuideModal({ onClose }) {
  return (
    <Modal title="🏆 Cách tính xếp hạng (Rating Glicko)" onClose={onClose}>
      <div className="rg-root">
        <p className="rg-intro">
          Mỗi người có một <strong>điểm rating</strong> (bắt đầu 1000). Sau mỗi trận, điểm đổi
          theo <strong>kết quả</strong> và <strong>trình độ đối thủ</strong> — không phải cứ đánh
          nhiều trận là điểm cao.
        </p>
        <div className="rg-quote">
          Thắng người <strong>mạnh hơn</strong> → cộng nhiều · Thua người <strong>yếu hơn</strong> → trừ nhiều.
        </div>

        <p className="rg-section-title">📌 Ví dụ</p>
        <div className="rg-example-grid">
          <div className="rg-example-card rg-card-win">
            <div className="rg-card-name">Bin (1000) thắng Lâm (1000)</div>
            <div className="rg-card-record">Ngang cơ</div>
            <div className="rg-card-score">Bin <strong>+16</strong>, Lâm −16</div>
            <div className="rg-card-note">Cân sức → đổi điểm vừa phải</div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Bin (1200) thắng Khách (1000)</div>
            <div className="rg-card-record">Bin mạnh hơn nhiều</div>
            <div className="rg-card-score">Bin chỉ <strong>+8</strong></div>
            <div className="rg-card-note">Thắng người yếu → lời ít</div>
          </div>
          <div className="rg-example-card rg-card-loss">
            <div className="rg-card-name">Bin (1200) thua Khách (1000)</div>
            <div className="rg-card-record">Bất ngờ</div>
            <div className="rg-card-score">Bin <strong>−24</strong></div>
            <div className="rg-card-note">Thua người yếu → mất nhiều</div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Người mới</div>
            <div className="rg-card-record">Mới đánh 1–2 trận</div>
            <div className="rg-card-score"><strong>Tạm tính</strong></div>
            <div className="rg-card-note">Đánh thêm vài trận là có hạng chính thức</div>
          </div>
        </div>

        <p className="rg-section-title">🏅 Bậc theo rating</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">💎</span><span><strong>Bạch kim</strong> — trên 1150</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🥇</span><span><strong>Vàng</strong> — 1050 đến 1150</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🥈</span><span><strong>Bạc</strong> — 950 đến 1050</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🥉</span><span><strong>Đồng</strong> — dưới 950</span></div>
        </div>

        <div className="rg-footer">
          Không cần ai đánh đủ số trận bằng nhau — rating tự cân bằng theo trình độ. Người vãng lai
          được gắn nhãn riêng. Mỗi kỳ bắt đầu lại từ 1000.
        </div>
      </div>
    </Modal>
  )
}
