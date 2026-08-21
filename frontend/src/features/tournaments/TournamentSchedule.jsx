import { CalendarRange, Swords, Trophy, UsersRound } from 'lucide-react'
import { TournamentMatchCard } from './TournamentMatchCard'

const KNOCKOUT_STAGE_ORDER = {
  quarterfinal: 1,
  semifinal: 2,
  third_place: 3,
  final: 4,
}

function groupCode(group, index) {
  return String(group?.code || String.fromCharCode(65 + index)).replace(/^Bảng\s+/i, '').toUpperCase()
}

function groupName(group, index) {
  const code = groupCode(group, index)
  return group?.name || `Bảng ${code}`
}

function completedCount(matches) {
  return matches.filter((match) => match.status === 'completed').length
}

export function TournamentSchedule({ groups = [], knockoutMatches = [], totalMatches = 0, admin = false, onEditMatch }) {
  const orderedGroups = [...groups].sort((left, right) => Number(left.position || 0) - Number(right.position || 0))
  const orderedKnockout = [...knockoutMatches].sort((left, right) =>
    (KNOCKOUT_STAGE_ORDER[left.stage] || 99) - (KNOCKOUT_STAGE_ORDER[right.stage] || 99) ||
    Number(left.bracket_position || 0) - Number(right.bracket_position || 0) ||
    Number(left.match_number || 0) - Number(right.match_number || 0)
  )
  const groupMatchCount = orderedGroups.reduce((total, group) => total + (group.matches?.length || 0), 0)

  return (
    <section className="tour-schedule">
      <header className="tour-schedule-summary">
        <div>
          <span className="tour-schedule-summary-icon"><CalendarRange size={19} /></span>
          <div><h3>Lịch thi đấu</h3><p>Theo dõi từng bảng và các vòng loại trực tiếp</p></div>
        </div>
        <strong>{totalMatches} trận</strong>
      </header>

      <section className="tour-schedule-stage">
        <header className="tour-schedule-stage-head">
          <div><UsersRound size={18} /><div><h4>Vòng bảng</h4><span>{orderedGroups.length} bảng · {groupMatchCount} trận</span></div></div>
        </header>

        <div className="tour-schedule-groups">
          {orderedGroups.map((group, groupIndex) => {
            const code = groupCode(group, groupIndex)
            const name = groupName(group, groupIndex)
            const matches = [...(group.matches || [])].sort((left, right) =>
              Number(left.bracket_position || 0) - Number(right.bracket_position || 0) ||
              Number(left.match_number || 0) - Number(right.match_number || 0)
            )
            const completed = completedCount(matches)

            return (
              <section className="tour-schedule-group" data-group={groupIndex % 4} key={group.id || code}>
                <header className="tour-schedule-group-head">
                  <span className="tour-group-letter">{code}</span>
                  <div><h4>{name}</h4><p>{group.standings?.length || 0} đội thi đấu vòng tròn</p></div>
                  <div className="tour-group-progress"><strong>{completed}/{matches.length}</strong><span>đã xong</span></div>
                </header>
                {matches.length ? <div className="tour-schedule-grid tour-schedule-group-grid">
                  {matches.map((match, matchIndex) => (
                    <TournamentMatchCard
                      key={match.id}
                      match={match}
                      label={`${name} · Trận ${matchIndex + 1}`}
                      admin={admin}
                      onEdit={onEditMatch}
                    />
                  ))}
                </div> : <div className="tour-empty">Bảng này chưa có lịch đấu.</div>}
              </section>
            )
          })}
          {!orderedGroups.length && <div className="tour-empty">Chưa có bảng đấu.</div>}
        </div>
      </section>

      {orderedKnockout.length > 0 && <section className="tour-schedule-stage tour-schedule-knockout">
        <header className="tour-schedule-stage-head">
          <div><Trophy size={18} /><div><h4>Vòng loại trực tiếp</h4><span>{orderedKnockout.length} trận quyết định</span></div></div>
          <Swords size={18} />
        </header>
        <div className="tour-schedule-grid">
          {orderedKnockout.map((match) => <TournamentMatchCard key={match.id} match={match} admin={admin} onEdit={onEditMatch} />)}
        </div>
      </section>}
    </section>
  )
}
