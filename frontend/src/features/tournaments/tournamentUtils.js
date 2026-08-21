export const TOURNAMENT_STATUS = {
  draft: ['Bản nháp', 'draft'],
  group_stage: ['Vòng bảng', 'groups'],
  knockout: ['Vòng trong', 'knockout'],
  completed: ['Đã kết thúc', 'completed'],
  cancelled: ['Đã hủy', 'cancelled'],
}

export const STAGE_LABELS = {
  group: 'Vòng bảng', quarterfinal: 'Tứ kết', semifinal: 'Bán kết',
  final: 'Chung kết', third_place: 'Tranh hạng ba',
}

export const MATCH_STATUS_LABELS = {
  pending: 'Chờ thi đấu', active: 'Đang thi đấu', completed: 'Đã kết thúc',
  cancelled: 'Đã hủy', bye: 'Miễn vòng',
}

export function personName(person) {
  return person?.nickname || person?.full_name || 'Thành viên'
}

export function teamMemberNames(team) {
  return (team?.members || []).map((member) => personName(member.person)).join(' & ')
}

export function formatTournamentDate(value, includeTime = false) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', includeTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage
}

export function tournamentProgress(tournament) {
  const playable = (tournament?.matches || []).filter((match) => match.status !== 'bye')
  const completed = playable.filter((match) => match.status === 'completed').length
  return { completed, total: playable.length, percent: playable.length ? Math.round((completed / playable.length) * 100) : 0 }
}

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function distributeTeams(teams, groupCount) {
  const groups = Array.from({ length: groupCount }, () => [])
  const seeded = teams.filter((team) => Number(team.seed) > 0).sort((a, b) => Number(a.seed) - Number(b.seed))
  const unseeded = shuffle(teams.filter((team) => !Number(team.seed)))
  seeded.forEach((team, index) => {
    const cycle = Math.floor(index / groupCount)
    const offset = index % groupCount
    groups[cycle % 2 === 0 ? offset : groupCount - 1 - offset].push(team)
  })
  for (const team of unseeded) {
    const smallest = Math.min(...groups.map((group) => group.length))
    const choices = groups.map((group, index) => ({ index, size: group.length })).filter((group) => group.size === smallest)
    groups[choices[Math.floor(Math.random() * choices.length)].index].push(team)
  }
  return teams.map((team) => ({ ...team, group_index: groups.findIndex((group) => group.includes(team)) + 1 }))
}

export function validKnockoutStarts(groupCount) {
  const qualifiers = Number(groupCount) * 2
  return [['final', 'Chung kết', 2], ['semifinal', 'Bán kết', 4], ['quarterfinal', 'Tứ kết', 8]]
    .filter(([, , capacity]) => capacity >= qualifiers)
}

export function defaultKnockoutStart(groupCount) {
  const qualifiers = Number(groupCount) * 2
  return qualifiers <= 2 ? 'final' : qualifiers <= 4 ? 'semifinal' : 'quarterfinal'
}
