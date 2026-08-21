import { CalendarDays, MapPin, Pencil, ShieldCheck } from 'lucide-react'
import { TeamAvatarStack } from './TeamAvatarStack'
import { formatTournamentDate, MATCH_STATUS_LABELS, stageLabel, teamMemberNames } from './tournamentUtils'

function TeamLine({ team, source, sets, winner }) {
  return (
    <div className={`tour-match-team${winner ? ' winner' : ''}${!team ? ' waiting' : ''}`}>
      <TeamAvatarStack team={team} size="small" />
      <div className="tour-match-team-copy"><strong>{team?.name || source || 'Chưa xác định'}</strong><small>{team ? teamMemberNames(team) : 'Đang chờ kết quả vòng trước'}</small></div>
      {winner && <ShieldCheck size={15} aria-label="Đội thắng" />}
      <b className="tour-match-set-total">{team ? sets : '-'}</b>
    </div>
  )
}

export function TournamentMatchCard({ match, admin = false, onEdit, compact = false }) {
  const canEdit = admin && match.status !== 'bye'
  return (
    <article className={`tour-match-card tour-match-card--${match.status}${compact ? ' compact' : ''}${canEdit ? ' editable' : ''}`} onClick={canEdit ? () => onEdit?.(match) : undefined}>
      <header className="tour-match-card-head">
        <span>{stageLabel(match.stage)} {match.bracket_position}</span>
        <span className={`tour-match-status status-${match.status}`}>{MATCH_STATUS_LABELS[match.status]}</span>
        {canEdit && <Pencil size={14} aria-hidden="true" />}
      </header>
      <TeamLine team={match.team1} source={match.team1_source} sets={match.team1_sets} winner={match.winner_team_id === match.team1_id} />
      <TeamLine team={match.team2} source={match.team2_source} sets={match.team2_sets} winner={match.winner_team_id === match.team2_id} />
      {match.set_scores?.length > 0 && <div className="tour-set-scores">{match.set_scores.map((score, index) => <span key={index}>H{index + 1} <b>{score.team1}-{score.team2}</b></span>)}</div>}
      {(match.scheduled_at || match.court) && <footer className="tour-match-meta">
        {match.scheduled_at && <span><CalendarDays size={13} />{formatTournamentDate(match.scheduled_at, true)}</span>}
        {match.court && <span><MapPin size={13} />{match.court}</span>}
      </footer>}
    </article>
  )
}
