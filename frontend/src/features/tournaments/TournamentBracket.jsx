import { useMemo, useState } from 'react'
import { TournamentMatchCard } from './TournamentMatchCard'
import { stageLabel } from './tournamentUtils'

const ORDER = ['quarterfinal', 'semifinal', 'final', 'third_place']

export function TournamentBracket({ matches = [], admin = false, onEdit }) {
  const stages = useMemo(() => ORDER.map((stage) => ({ stage, matches: matches.filter((match) => match.stage === stage) })).filter((item) => item.matches.length), [matches])
  const [mobileStage, setMobileStage] = useState(stages[0]?.stage || '')
  const effectiveMobileStage = stages.some((item) => item.stage === mobileStage) ? mobileStage : stages[0]?.stage
  const activeMobile = stages.find((item) => item.stage === effectiveMobileStage) || stages[0]
  if (!stages.length) return <div className="tour-empty tour-empty-bracket"><strong>Vòng trong chưa được tạo</strong><span>Hoàn tất vòng bảng để xác định các đội đi tiếp.</span></div>

  return (
    <section className="tour-bracket-shell">
      <div className="tour-bracket-mobile-tabs">{stages.map(({ stage }) => <button key={stage} className={activeMobile?.stage === stage ? 'active' : ''} onClick={() => setMobileStage(stage)}>{stageLabel(stage)}</button>)}</div>
      <div className="tour-bracket-mobile-list">{activeMobile?.matches.map((match) => <TournamentMatchCard key={match.id} match={match} admin={admin} onEdit={onEdit} />)}</div>
      <div className="tour-bracket-desktop">
        {stages.filter(({ stage }) => stage !== 'third_place').map(({ stage, matches: stageMatches }) => (
          <div className={`tour-bracket-column stage-${stage}`} key={stage}>
            <header><span>{stageLabel(stage)}</span><small>{stageMatches.length} trận</small></header>
            <div className="tour-bracket-column-matches">{stageMatches.map((match) => <div className="tour-bracket-node" key={match.id}><TournamentMatchCard match={match} admin={admin} onEdit={onEdit} compact /></div>)}</div>
          </div>
        ))}
      </div>
      {stages.find(({ stage }) => stage === 'third_place')?.matches.map((match) => <div className="tour-third-place" key={match.id}><h3>Tranh hạng ba</h3><TournamentMatchCard match={match} admin={admin} onEdit={onEdit} /></div>)}
    </section>
  )
}
