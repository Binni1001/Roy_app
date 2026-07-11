import { Modal } from '../../../components/common'
import { initials } from '../../../utils/appUtils'
import { MIN_MATCHES_FOR_RANK } from '../../../utils/leaderboardUtils'

function getTierCls(rank, total) {
  if (rank === 1) return 'lb-tier-gold'
  if (rank === 2) return 'lb-tier-silver'
  if (rank === 3) return 'lb-tier-bronze'
  if (total >= 5 && rank >= total - 1) return 'lb-tier-bottom'
  return ''
}

function RankBadge({ rank, total }) {
  if (rank === 1) return <span className="lb-rank-badge lb-gold">🥇</span>
  if (rank === 2) return <span className="lb-rank-badge lb-silver">🥈</span>
  if (rank === 3) return <span className="lb-rank-badge lb-bronze">🥉</span>
  if (total >= 5 && rank === total) return <span className="lb-rank-badge lb-last">💀</span>
  if (total >= 5 && rank === total - 1) return <span className="lb-rank-badge lb-near-last">😅</span>
  return <span className="lb-rank-num">{rank}</span>
}

// Điểm trung bình mỗi trận — chỉ số xếp hạng chính
function AvgPointsCell({ value, qualified }) {
  if (!qualified) {
    return <small className="muted">Chưa đủ {MIN_MATCHES_FOR_RANK} trận</small>
  }
  const v = value || 0
  const txt = (v >= 0 ? '+' : '') + v.toFixed(1)
  const color = v > 0.5 ? '#5ee0a8' : v < 0 ? '#f08a8a' : '#f0d486'
  return <strong className="lb-avg" style={{ color }}>{txt}<small className="muted"> đ/trận</small></strong>
}

export function LeaderboardRow({ row, isMe, total }) {
  const tierCls = row.qualified ? getTierCls(row.rank, total) : 'lb-row-unqualified'
  return (
    <tr className={`${isMe ? 'pk-row-me' : ''} ${tierCls}`}>
      <td>{row.rank ? <RankBadge rank={row.rank} total={total} /> : <span className="lb-rank-num muted">–</span>}</td>
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
      <td className="lb-points"><span className="lb-points-chip">{row.points ?? 0}</span></td>
      <td><AvgPointsCell value={row.avg_points} qualified={row.qualified} /></td>
    </tr>
  )
}

export function LeaderboardLegend({ total, onShowGuide }) {
  return (
    <div className="lb-legend">
      <span className="lb-legend-item"><span className="lb-dot lb-dot-gold" />Top 3</span>
      <span className="lb-legend-item"><span className="lb-dot lb-dot-mid" />Trung bình</span>
      {total >= 5 && <span className="lb-legend-item"><span className="lb-dot lb-dot-bottom" />Cần cố gắng</span>}
      <span className="lb-legend-sep">|</span>
      <span className="lb-legend-hint">Xếp theo <strong>điểm trung bình mỗi trận</strong> · cần ≥ {MIN_MATCHES_FOR_RANK} trận mới lên bảng</span>
      <button className="lb-guide-btn" onClick={onShowGuide}>❓ Cách xếp hạng</button>
    </div>
  )
}

export function RankingGuideModal({ onClose }) {
  return (
    <Modal title="🏆 Cách tính xếp hạng" onClose={onClose}>
      <div className="rg-root">
        <p className="rg-intro">
          Xếp hạng theo <strong>điểm trung bình mỗi trận</strong> — công bằng dù người đánh nhiều,
          người đánh ít. Không phải ai đánh nhiều trận hơn là hạng cao hơn.
        </p>
        <div className="rg-quote">
          Điểm mỗi trận = <strong>+3 nếu thắng, −1 nếu thua</strong>. Điểm TB = tổng điểm ÷ số trận.
        </div>

        <p className="rg-section-title">📌 Ví dụ</p>
        <div className="rg-example-grid">
          <div className="rg-example-card rg-card-win">
            <div className="rg-card-name">Anh Lâm</div>
            <div className="rg-card-record">8 thắng · 2 thua (10 trận)</div>
            <div className="rg-card-score">Điểm TB: <strong>+2.2</strong></div>
            <div className="rg-card-note">Tỷ lệ thắng cao → điểm TB cao → hạng trên</div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Bin</div>
            <div className="rg-card-record">3 thắng · 1 thua (4 trận)</div>
            <div className="rg-card-score">Điểm TB: <strong>+2.0</strong></div>
            <div className="rg-card-note">Đánh ít hơn nhưng vẫn được so công bằng theo TB</div>
          </div>
          <div className="rg-example-card rg-card-loss">
            <div className="rg-card-name">Anh Khanh</div>
            <div className="rg-card-record">2 thắng · 3 thua (5 trận)</div>
            <div className="rg-card-score">Điểm TB: <strong>+0.6</strong></div>
            <div className="rg-card-note">Thua nhiều hơn → điểm TB thấp</div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Khách mới</div>
            <div className="rg-card-record">2 thắng · 0 thua (2 trận)</div>
            <div className="rg-card-score"><strong>Chưa xếp hạng</strong></div>
            <div className="rg-card-note">Chưa đủ {MIN_MATCHES_FOR_RANK} trận → xuống cuối bảng, chưa có hạng</div>
          </div>
        </div>

        <p className="rg-section-title">💡 Quy tắc</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">⚖️</span><span>Xếp theo <strong>điểm trung bình mỗi trận</strong> → đánh nhiều hay ít đều công bằng</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🎯</span><span>Phải đánh <strong>đủ ≥ {MIN_MATCHES_FOR_RANK} trận</strong> mới được xếp hạng chính thức</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🧳</span><span>Người <strong>vãng lai</strong> được gắn nhãn riêng để dễ phân biệt với thành viên cố định</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🔄</span><span>Mỗi kỳ có bảng xếp hạng riêng — qua kỳ mới bắt đầu lại</span></div>
        </div>

        <div className="rg-footer">
          Cột "Điểm" là tổng điểm tích luỹ; cột "Điểm TB/trận" mới là chỉ số dùng để xếp hạng.
        </div>
      </div>
    </Modal>
  )
}
