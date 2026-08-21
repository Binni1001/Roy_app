import { Plus, Shuffle, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '../../../../components/common'
import { defaultKnockoutStart, distributeTeams, personName, validKnockoutStarts } from '../../../tournaments/tournamentUtils'

function blankTeam(groupIndex = 1) {
  return { key: crypto.randomUUID(), name: '', member_ids: ['', ''], seed: '', group_index: groupIndex }
}

function initialTeams(tournament) {
  if (!tournament.teams.length) return Array.from({ length: Math.max(4, tournament.group_count * 2) }, (_, index) => blankTeam((index % tournament.group_count) + 1))
  return tournament.teams.map((team) => {
    const group = tournament.groups.find((item) => item.standings.some((row) => row.team_id === team.id))
    return {
      key: team.id,
      name: team.name,
      member_ids: team.members.map((member) => member.person_id),
      seed: team.seed || '',
      group_index: group?.position || 1,
    }
  })
}

export function TournamentSetupModal({ tournament, people, onClose, onSubmit, saving }) {
  const [groupCount, setGroupCount] = useState(tournament.group_count || 2)
  const [bestOf, setBestOf] = useState(tournament.best_of || 3)
  const [knockoutStart, setKnockoutStart] = useState(tournament.knockout_start || defaultKnockoutStart(groupCount))
  const [thirdPlace, setThirdPlace] = useState(Boolean(tournament.third_place_enabled))
  const [teams, setTeams] = useState(() => initialTeams(tournament))
  const [error, setError] = useState('')
  const activePeople = useMemo(() => people.filter((person) => person.status === 'active'), [people])

  function updateTeam(index, patch) {
    setTeams((current) => current.map((team, teamIndex) => teamIndex === index ? { ...team, ...patch } : team))
  }

  function updateMember(teamIndex, memberIndex, personId) {
    const memberIds = [...teams[teamIndex].member_ids]
    memberIds[memberIndex] = personId
    const selected = memberIds.map((id) => activePeople.find((person) => person.id === id)).filter(Boolean)
    const generatedName = selected.length === 2 ? selected.map(personName).join(' & ') : teams[teamIndex].name
    updateTeam(teamIndex, { member_ids: memberIds, name: generatedName })
  }

  function changeGroupCount(value) {
    const next = Number(value)
    setGroupCount(next)
    setKnockoutStart(defaultKnockoutStart(next))
    setTeams((current) => current.map((team, index) => ({ ...team, group_index: (index % next) + 1 })))
  }

  function submit(event) {
    event.preventDefault()
    const memberIds = teams.flatMap((team) => team.member_ids).filter(Boolean)
    if (teams.length < groupCount * 2) return setError('Mỗi bảng cần ít nhất hai đội.')
    if (teams.some((team) => !team.name.trim() || team.member_ids.filter(Boolean).length !== 2)) return setError('Mỗi đội cần tên và đúng hai thành viên.')
    if (new Set(memberIds).size !== memberIds.length) return setError('Một thành viên không thể nằm trong hai đội.')
    const seeds = teams.map((team) => Number(team.seed)).filter((seed) => seed > 0)
    if (new Set(seeds).size !== seeds.length) return setError('Mỗi hạt giống chỉ được gán cho một đội.')
    const groupSizes = Array.from({ length: groupCount }, (_, index) => teams.filter((team) => Number(team.group_index) === index + 1).length)
    if (groupSizes.some((size) => size < 2)) return setError('Mỗi bảng cần ít nhất hai đội.')
    setError('')
    onSubmit({
      group_count: groupCount, best_of: bestOf, knockout_start: knockoutStart,
      third_place_enabled: thirdPlace,
      teams: teams.map((team) => ({ name: team.name.trim(), member_ids: team.member_ids, seed: team.seed ? Number(team.seed) : null, group_index: Number(team.group_index) })),
    })
  }

  return (
    <Modal title="Xếp đội và chia bảng" onClose={onClose}>
      <form className="tour-setup" onSubmit={submit}>
        {tournament.matches.some((match) => match.status === 'completed') && <div className="tour-reset-warning">Lưu cấu hình sẽ dựng lại toàn bộ vòng bảng và xóa các kết quả hiện tại. Admin vẫn có thể thực hiện sau khi xác nhận.</div>}
        <div className="tour-setup-options">
          <label>Số bảng<select value={groupCount} onChange={(event) => changeGroupCount(event.target.value)}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value} bảng</option>)}</select></label>
          <label>Vòng trong<select value={knockoutStart} onChange={(event) => setKnockoutStart(event.target.value)}>{validKnockoutStarts(groupCount).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Thể thức<select value={bestOf} onChange={(event) => setBestOf(Number(event.target.value))}><option value={1}>1 hiệp</option><option value={3}>3 hiệp</option><option value={5}>5 hiệp</option></select></label>
          <label className="tour-check-line"><input type="checkbox" checked={thirdPlace} onChange={(event) => setThirdPlace(event.target.checked)} />Tranh hạng ba</label>
        </div>
        <div className="tour-setup-toolbar"><div><strong>{teams.length} đội</strong><span>Hạt giống được tách đều trước khi xáo đội còn lại.</span></div><button type="button" onClick={() => setTeams(distributeTeams(teams, groupCount))}><Shuffle size={16} />Chia ngẫu nhiên</button></div>
        <div className="tour-team-editor-list">
          {teams.map((team, teamIndex) => <div className="tour-team-editor" key={team.key}>
            <span className="tour-team-editor-index">{teamIndex + 1}</span>
            <label>Tên đội<input value={team.name} onChange={(event) => updateTeam(teamIndex, { name: event.target.value })} placeholder="Tên đội" /></label>
            {[0, 1].map((memberIndex) => <label key={memberIndex}>Thành viên {memberIndex + 1}<select value={team.member_ids[memberIndex] || ''} onChange={(event) => updateMember(teamIndex, memberIndex, event.target.value)}><option value="">Chọn người</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{personName(person)}</option>)}</select></label>)}
            <label>Hạt giống<input type="number" min="1" max={teams.length} value={team.seed} onChange={(event) => updateTeam(teamIndex, { seed: event.target.value })} placeholder="Không" /></label>
            <label>Bảng<select value={team.group_index} onChange={(event) => updateTeam(teamIndex, { group_index: Number(event.target.value) })}>{Array.from({ length: groupCount }, (_, index) => <option key={index} value={index + 1}>Bảng {String.fromCharCode(65 + index)}</option>)}</select></label>
            <button type="button" className="icon-button tour-remove-team" onClick={() => setTeams((current) => current.filter((_, index) => index !== teamIndex))} aria-label="Xóa đội"><Trash2 size={16} /></button>
          </div>)}
        </div>
        <button type="button" className="tour-add-team" onClick={() => setTeams((current) => [...current, blankTeam((current.length % groupCount) + 1)])}><Plus size={16} />Thêm đội</button>
        {error && <p className="form-error">{error}</p>}
        <footer className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving}>{saving ? 'Đang dựng...' : 'Lưu và dựng vòng bảng'}</button></footer>
      </form>
    </Modal>
  )
}
