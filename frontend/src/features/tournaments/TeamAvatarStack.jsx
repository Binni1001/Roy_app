import { initials } from '../../utils/appUtils'

function MemberAvatar({ person, index }) {
  const label = person?.nickname || person?.full_name || 'Thành viên'
  if (person?.avatar_url) return <img src={person.avatar_url} alt={label} style={{ '--avatar-index': index }} />
  return <span style={{ '--avatar-index': index }}>{initials(label)}</span>
}

export function TeamAvatarStack({ team, size = 'normal' }) {
  const members = (team?.members || []).slice(0, 2)
  return (
    <div className={`tour-avatar-stack tour-avatar-stack--${size}`} aria-label={team?.name || 'Đội chưa xác định'}>
      {members.length ? members.map((member, index) => (
        <MemberAvatar key={member.id || member.person_id || index} person={member.person} index={index} />
      )) : <span style={{ '--avatar-index': 0 }}>?</span>}
    </div>
  )
}
