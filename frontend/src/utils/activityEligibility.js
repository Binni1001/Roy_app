export function isActivityPerson(person) {
  return person?.status === 'active'
    && person.activity_eligible !== false
    && (!person.account_role || person.account_role === 'user')
}
