import { ArrowDown, ArrowUp, Swords } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../../../components/common'
import { MATCH_STATUS_LABELS } from '../../../tournaments/tournamentUtils'

function orderedMatches(group) {
  return [...(group.matches || [])].sort((left, right) =>
    Number(left.bracket_position || 0) - Number(right.bracket_position || 0) ||
    Number(left.match_number || 0) - Number(right.match_number || 0)
  )
}

export function TournamentMatchOrderModal({ group, onClose, onSubmit, saving }) {
  const [matches, setMatches] = useState(() => orderedMatches(group))

  function move(index, offset) {
    const target = index + offset
    if (target < 0 || target >= matches.length) return
    setMatches((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function submit(event) {
    event.preventDefault()
    onSubmit(matches.map((match) => match.id))
  }

  return (
    <Modal title={`Sắp thứ tự ${group.display_name || group.name}`} onClose={onClose}>
      <form className="tour-match-order-form" onSubmit={submit}>
        <p>Trận ở trên sẽ được hiển thị trước. Tỷ số và kết quả hiện tại được giữ nguyên.</p>
        <div className="tour-match-order-list">
          {matches.map((match, index) => <div className="tour-match-order-row" key={match.id}>
            <span className="tour-match-order-number">{index + 1}</span>
            <div className="tour-match-order-versus">
              <strong>{match.team1?.name || 'Chưa xác định'}</strong>
              <span><Swords size={13} />đấu với</span>
              <strong>{match.team2?.name || 'Chưa xác định'}</strong>
            </div>
            <span className={`tour-match-status status-${match.status}`}>{MATCH_STATUS_LABELS[match.status]}</span>
            <div className="tour-match-order-actions">
              <button type="button" className="icon-button" onClick={() => move(index, -1)} disabled={index === 0} title="Đưa trận lên" aria-label={`Đưa trận ${index + 1} lên`}><ArrowUp size={16} /></button>
              <button type="button" className="icon-button" onClick={() => move(index, 1)} disabled={index === matches.length - 1} title="Đưa trận xuống" aria-label={`Đưa trận ${index + 1} xuống`}><ArrowDown size={16} /></button>
            </div>
          </div>)}
        </div>
        <footer className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thứ tự'}</button></footer>
      </form>
    </Modal>
  )
}
