import { CalendarDays, CheckCircle2, Flag, Trophy, Users } from 'lucide-react'
import { TeamAvatarStack } from './TeamAvatarStack'
import { TournamentBracket } from './TournamentBracket'
import { TournamentMatchCard } from './TournamentMatchCard'
import { TournamentSchedule } from './TournamentSchedule'
import { TournamentStandings } from './TournamentStandings'
import { formatTournamentDate, teamMemberNames, TOURNAMENT_STATUS, tournamentProgress } from './tournamentUtils'

export function TournamentView({ tournament, tab, setTab, admin = false, onEditMatch }) {
  const progress = tournamentProgress(tournament)
  const knockoutMatches = tournament.matches.filter((match) => match.stage !== 'group')
  const upcoming = tournament.matches.filter((match) => match.status === 'pending' || match.status === 'active').slice(0, 4)
  const [statusLabel, statusClass] = TOURNAMENT_STATUS[tournament.status] || [tournament.status, 'draft']

  return (
    <div className="tour-view">
      <section className="tour-hero">
        <div className="tour-hero-copy">
          <span className={`tour-status-pill status-${statusClass}`}>{statusLabel}</span>
          <h2>{tournament.name}</h2>
          <p>{tournament.description || 'Giải đôi Roy Badminton'}</p>
          <div className="tour-hero-meta">
            <span><Users size={15} />{tournament.teams.length} đội</span>
            <span><CalendarDays size={15} />{formatTournamentDate(tournament.start_date) || 'Chưa xếp ngày'}</span>
            <span><Flag size={15} />Thắng {Math.floor(tournament.best_of / 2) + 1} hiệp</span>
          </div>
        </div>
        <div className="tour-hero-trophy"><Trophy size={42} /><small>Nhà vô địch</small><strong>{tournament.champion_team?.name || 'Đang chờ'}</strong></div>
      </section>

      <nav className="tour-tabs" aria-label="Nội dung giải đấu">
        {[['overview', 'Tổng quan'], ['groups', 'Vòng bảng'], ['bracket', 'Vòng trong'], ['schedule', 'Lịch đấu'], ['teams', 'Các đội']].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' && <div className="tour-overview">
        <section className="tour-progress-band">
          <div><CheckCircle2 size={22} /><span><strong>{progress.completed}/{progress.total}</strong> trận hoàn tất</span></div>
          <div className="tour-progress-track"><span style={{ width: `${progress.percent}%` }} /></div><b>{progress.percent}%</b>
        </section>
        <div className="tour-overview-grid">
          <section className="tour-section"><header><h3>Trận sắp tới</h3><span>{upcoming.length} trận</span></header><div className="tour-match-list">
            {upcoming.length ? upcoming.map((match) => <TournamentMatchCard key={match.id} match={match} admin={admin} onEdit={onEditMatch} />) : <div className="tour-empty">Không còn trận đang chờ.</div>}
          </div></section>
          <section className="tour-section"><header><h3>Đội dẫn đầu các bảng</h3><span>{tournament.groups.length} bảng</span></header><div className="tour-group-leaders">
            {tournament.groups.map((group) => { const leader = group.standings[0]; return <div key={group.id}><span>{group.code}</span><TeamAvatarStack team={leader?.team} size="small" /><div><strong>{leader?.team?.name || 'Chưa có'}</strong><small>{leader ? `${leader.standing_points} điểm` : 'Chưa thi đấu'}</small></div></div> })}
          </div></section>
        </div>
      </div>}

      {tab === 'groups' && <div className="tour-section"><TournamentStandings groups={tournament.groups} /></div>}
      {tab === 'bracket' && <div className="tour-section tour-section-bracket"><TournamentBracket matches={knockoutMatches} admin={admin} onEdit={onEditMatch} /></div>}
      {tab === 'schedule' && <TournamentSchedule groups={tournament.groups} knockoutMatches={knockoutMatches} totalMatches={tournament.matches.length} admin={admin} onEditMatch={onEditMatch} />}
      {tab === 'teams' && <div className="tour-section"><header><h3>Danh sách đội</h3><span>{tournament.teams.length} đội</span></header><div className="tour-team-grid">
        {tournament.teams.map((team) => { const group = tournament.groups.find((item) => item.standings.some((row) => row.team_id === team.id)); return <article className="tour-team-card" key={team.id}><TeamAvatarStack team={team} size="large" /><div><strong>{team.name}</strong><span>{teamMemberNames(team)}</span></div><footer>{team.seed && <span>Hạt giống {team.seed}</span>}{group && <span>{group.name}</span>}</footer></article> })}
      </div></div>}
    </div>
  )
}
