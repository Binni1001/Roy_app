import { AlertTriangle, CalendarClock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '../../../../components/common'
import { TeamAvatarStack } from '../../../tournaments/TeamAvatarStack'
import { stageLabel, teamMemberNames } from '../../../tournaments/tournamentUtils'

function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyScores(bestOf) {
  return Array.from({ length: Math.floor(bestOf / 2) + 1 }, () => ({ team1: '', team2: '' }))
}

export function TournamentScoreModal({ tournament, match, onClose, onSubmit, saving }) {
  const [status, setStatus] = useState(match.status === 'bye' ? 'pending' : match.status)
  const [team1Id, setTeam1Id] = useState(match.team1_id || '')
  const [team2Id, setTeam2Id] = useState(match.team2_id || '')
  const [scores, setScores] = useState(match.set_scores?.length ? match.set_scores : emptyScores(tournament.best_of))
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(match.scheduled_at))
  const [court, setCourt] = useState(match.court || '')
  const [note, setNote] = useState(match.note || '')
  const [error, setError] = useState('')
  const hasKnockout = tournament.matches.some((item) => item.stage !== 'group')
  const rebuildWarning = match.stage === 'group' && hasKnockout
  const eligibleTeams = useMemo(() => {
    if (match.stage !== 'group') return tournament.teams
    const group = tournament.groups.find((item) => item.id === match.group_id)
    const teamIds = new Set((group?.standings || []).map((row) => row.team_id))
    return tournament.teams.filter((team) => teamIds.has(team.id))
  }, [match.group_id, match.stage, tournament.groups, tournament.teams])
  const team1 = useMemo(() => tournament.teams.find((team) => team.id === team1Id), [team1Id, tournament.teams])
  const team2 = useMemo(() => tournament.teams.find((team) => team.id === team2Id), [team2Id, tournament.teams])

  function setScore(index, side, value) {
    setScores((current) => current.map((score, scoreIndex) => scoreIndex === index ? { ...score, [side]: value } : score))
  }

  function submit(event) {
    event.preventDefault()
    if (team1Id && team1Id === team2Id) return setError('Hai bên phải là hai đội khác nhau.')
    const normalized = scores.filter((score) => score.team1 !== '' || score.team2 !== '').map((score) => ({ team1: Number(score.team1), team2: Number(score.team2) }))
    if (status === 'completed' && (!team1Id || !team2Id || !normalized.length || normalized.some((score) => score.team1 === score.team2))) {
      return setError('Hãy chọn đủ hai đội và nhập tỷ số hợp lệ cho từng hiệp.')
    }
    setError('')
    onSubmit({
      status, team1_id: team1Id || null, team2_id: team2Id || null,
      set_scores: status === 'completed' ? normalized : [],
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      court: court.trim() || null, note: note.trim() || null,
      rebuild_knockout: rebuildWarning,
    })
  }

  return (
    <Modal title={`Cập nhật ${stageLabel(match.stage).toLowerCase()} ${match.bracket_position}`} onClose={onClose}>
      <form className="tour-score-form" onSubmit={submit}>
        {rebuildWarning && <div className="tour-reset-warning"><AlertTriangle size={17} />Kết quả vòng bảng này đã ảnh hưởng vòng trong. Khi lưu, hệ thống sẽ dựng lại vòng trong theo bảng xếp hạng mới.</div>}
        <div className="tour-score-teams">
          <label><span>Đội thứ nhất</span><select value={team1Id} onChange={(event) => setTeam1Id(event.target.value)}><option value="">Chưa xác định</option>{eligibleTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <span className="tour-score-versus">ĐẤU</span>
          <label><span>Đội thứ hai</span><select value={team2Id} onChange={(event) => setTeam2Id(event.target.value)}><option value="">Chưa xác định</option>{eligibleTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        </div>
        <div className="tour-score-team-preview">
          <div><TeamAvatarStack team={team1} /><strong>{team1?.name || 'Đội thứ nhất'}</strong><small>{teamMemberNames(team1)}</small></div>
          <div><TeamAvatarStack team={team2} /><strong>{team2?.name || 'Đội thứ hai'}</strong><small>{teamMemberNames(team2)}</small></div>
        </div>
        <label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Chờ thi đấu</option><option value="active">Đang thi đấu</option><option value="completed">Đã kết thúc</option><option value="cancelled">Đã hủy</option></select></label>
        {status === 'completed' && <div className="tour-score-sets">
          <div className="tour-score-head"><span>Hiệp</span><strong>{team1?.name || 'Đội 1'}</strong><strong>{team2?.name || 'Đội 2'}</strong></div>
          {scores.map((score, index) => <div className="tour-score-row" key={index}><span>Hiệp {index + 1}</span><input type="number" min="0" value={score.team1} onChange={(event) => setScore(index, 'team1', event.target.value)} /><input type="number" min="0" value={score.team2} onChange={(event) => setScore(index, 'team2', event.target.value)} /></div>)}
          {scores.length < tournament.best_of && <button type="button" onClick={() => setScores((current) => [...current, { team1: '', team2: '' }])}>Thêm hiệp quyết định</button>}
        </div>}
        <div className="tour-form-grid">
          <label><span><CalendarClock size={14} />Thời gian</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
          <label>Sân<input value={court} onChange={(event) => setCourt(event.target.value)} placeholder="Ví dụ: Sân 2" /></label>
        </div>
        <label>Ghi chú<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <footer className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu trận đấu'}</button></footer>
      </form>
    </Modal>
  )
}
