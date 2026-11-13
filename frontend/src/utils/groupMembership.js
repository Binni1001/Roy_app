/**
 * Same rule as backend/src/middleware/attendanceGroupScope.js: a person may join a
 * period only through an ACTIVE person_groups row for the period's own group.
 * Legacy people.group_id / active_group_id links are NOT enough for the backend,
 * so the picker must not offer people who only match through them.
 */
export function hasActiveGroupMembership(person, groupId) {
  if (!person || !groupId) return false
  return (person.person_groups || []).some(
    (membership) => membership.group_id === groupId && membership.status === 'active',
  )
}
