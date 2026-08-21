import { useState } from 'react'
import { TeamAvatarStack } from './TeamAvatarStack'

function Difference({ value }) {
  const number = Number(value || 0)
  return <span className={number > 0 ? 'positive' : number < 0 ? 'negative' : ''}>{number > 0 ? `+${number}` : number}</span>
}

export function TournamentStandings({ groups = [] }) {
  const [selected, setSelected] = useState(groups[0]?.id || '')
  const effectiveSelected = groups.some((group) => group.id === selected) ? selected : groups[0]?.id
  const activeGroup = groups.find((group) => group.id === effectiveSelected) || groups[0]
  if (!activeGroup) return <div className="tour-empty">Chưa có bảng đấu.</div>

  return (
    <section className="tour-standings-section">
      <div className="tour-group-switcher" role="tablist" aria-label="Chọn bảng đấu">
        {groups.map((group) => <button type="button" key={group.id} className={activeGroup.id === group.id ? 'active' : ''} onClick={() => setSelected(group.id)}>{group.name}</button>)}
      </div>
      <div className="tour-standing-wrap">
        <div className="tour-standing-title"><div><span>{activeGroup.code}</span><strong>{activeGroup.name}</strong></div><small>Hai đội đầu bảng đi tiếp</small></div>
        <div className="table-wrap">
          <table className="tour-standing-table">
            <thead><tr><th>Hạng</th><th>Đội</th><th>Trận</th><th>Thắng</th><th>Thua</th><th>Hiệp</th><th>Điểm cầu</th><th>Điểm</th></tr></thead>
            <tbody>{activeGroup.standings.map((row) => (
              <tr key={row.team_id} className={row.qualified ? 'qualified' : ''}>
                <td><span className="tour-rank-number">{row.rank}</span></td>
                <td><div className="tour-table-team"><TeamAvatarStack team={row.team} size="tiny" /><div><strong>{row.team?.name}</strong>{row.team?.seed && <small>Hạt giống {row.team.seed}</small>}</div></div></td>
                <td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td>
                <td>{row.sets_for}-{row.sets_against} <Difference value={row.set_difference} /></td>
                <td>{row.points_for}-{row.points_against} <Difference value={row.point_difference} /></td>
                <td><b className="tour-standing-points">{row.standing_points}</b></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
