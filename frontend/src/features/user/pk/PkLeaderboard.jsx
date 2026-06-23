import { Modal } from '../../../components/common'
import { initials } from '../../../utils/appUtils'

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

function WilsonBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score || 0) * 100))
  const display = Math.round(pct)
  let cls = 'lb-bar-low'
  if (pct >= 60) cls = 'lb-bar-high'
  else if (pct >= 40) cls = 'lb-bar-mid'
  return (
    <div className="lb-bar-wrap" title={`${display}%`}>
      <div className={`lb-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      <span className="lb-bar-label">{display}%</span>
    </div>
  )
}

export function LeaderboardRow({ row, isMe, total }) {
  const tierCls = getTierCls(row.rank, total)
  return (
    <tr className={`${isMe ? 'pk-row-me' : ''} ${tierCls}`}>
      <td><RankBadge rank={row.rank} total={total} /></td>
      <td>
        <div className="pk-person-cell">
          {row.avatar_url
            ? <img src={row.avatar_url} className="avatar avatar-img pk-avatar" alt={row.full_name} />
            : <span className="avatar pk-avatar">{initials(row.full_name)}</span>}
          <span>{row.full_name}{row.nickname ? <small className="muted"> · {row.nickname}</small> : null}</span>
        </div>
      </td>
      <td className="pk-win">{row.wins}</td>
      <td className="pk-loss">{row.losses}</td>
      <td className="lb-total">{row.total_matches}</td>
      <td className="lb-points"><span className="lb-points-chip">{row.points ?? 0}</span></td>
      <td><WilsonBar score={row.wilson_score} /></td>
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
      <span className="lb-legend-hint">★ Chỉ số Wilson — đánh nhiều trận mới được điểm cao</span>
      <button className="lb-guide-btn" onClick={onShowGuide}>❓ Cách xếp hạng</button>
    </div>
  )
}

export function RankingGuideModal({ onClose }) {
  return (
    <Modal title="🏆 Cách tính xếp hạng" onClose={onClose}>
      <div className="rg-root">
        <p className="rg-intro">
          Xếp hạng dựa trên <strong>Chỉ số ★</strong> — không phải số trận thắng đơn thuần.
          Chỉ số này trả lời câu hỏi:
        </p>
        <div className="rg-quote">
          "Nếu người này đánh lâu dài, tỷ lệ thắng tối thiểu của họ là bao nhiêu?"
        </div>

        <p className="rg-section-title">📌 Ví dụ thực tế</p>

        <div className="rg-example-grid">
          <div className="rg-example-card rg-card-win">
            <div className="rg-card-name">Anh Lâm</div>
            <div className="rg-card-record">2 thắng · 0 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>34%</strong></div>
            <div className="rg-card-note">Chưa thua lần nào → chỉ số cao → <strong>#1</strong></div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Anh Thế</div>
            <div className="rg-card-record">3 thắng · 1 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>30%</strong></div>
            <div className="rg-card-note">Thắng nhiều hơn nhưng đã thua 1 lần → chỉ số thấp hơn Lâm</div>
          </div>
          <div className="rg-example-card rg-card-mid">
            <div className="rg-card-name">Bin</div>
            <div className="rg-card-record">2 thắng · 2 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>15%</strong></div>
            <div className="rg-card-note">Tỷ lệ thắng 50/50 → chỉ số trung bình</div>
          </div>
          <div className="rg-example-card rg-card-loss">
            <div className="rg-card-name">Anh Khanh</div>
            <div className="rg-card-record">2 thắng · 3 thua</div>
            <div className="rg-card-score">Chỉ số: <strong>11%</strong></div>
            <div className="rg-card-note">Thua nhiều hơn thắng → chỉ số thấp nhất</div>
          </div>
        </div>

        <p className="rg-section-title">💡 Quy tắc đơn giản</p>
        <div className="rg-rules">
          <div className="rg-rule"><span className="rg-rule-icon">📈</span><span>Đánh <strong>càng nhiều trận</strong>, chỉ số càng chính xác và tăng lên</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🔥</span><span>Thắng liên tiếp → leo hạng nhanh</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">📉</span><span>Thua nhiều → chỉ số tụt ngay dù trước đó thắng nhiều</span></div>
          <div className="rg-rule"><span className="rg-rule-icon">🆕</span><span>Mới vào thắng 1 trận <strong>không thể leo #1</strong> — phải chứng minh qua nhiều trận</span></div>
        </div>

        <div className="rg-footer">
          Điểm (+3 thắng / -1 thua) chỉ dùng để phân biệt khi 2 người có chỉ số bằng nhau.
        </div>
      </div>
    </Modal>
  )
}
