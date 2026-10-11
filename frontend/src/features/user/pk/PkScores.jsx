export function MatchSetScores({ scores }) {
  if (!scores?.length) return <small className="pk-set-missing">Chưa lưu tỷ số set</small>
  return <div className="pk-set-scores" aria-label="Tỷ số từng set: bên thách đấu và bên đối thủ">
    {scores.map((score, index) => <div className="pk-set-score-line" key={index}>
      <small>Set {index + 1}</small>
      <strong>{score.challenger ?? '—'}<span>–</span>{score.opponent ?? '—'}</strong>
    </div>)}
  </div>
}
