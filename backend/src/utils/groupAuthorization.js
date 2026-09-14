import { getUserRole } from "./roles.js";

export const isGroupId = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function assignedGroupIds(user) {
  const ids = user?.app_metadata?.managed_group_ids;
  if (!Array.isArray(ids) || !ids.every(isGroupId)) return [];
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

export function canManageGroup(user, groupId) {
  const role = getUserRole(user);
  return role === "owner" || (role === "admin" && isGroupId(groupId) &&
    assignedGroupIds(user).includes(groupId.toLowerCase()));
}

export function personGroupIds(person) {
  const memberships = person?.person_groups || [];
  // active_group_id is a viewing preference, never proof of membership.
  return [...new Set(memberships.length
    ? memberships.map((membership) => membership.group_id)
    : [person?.group_id].filter(Boolean))];
}

export function canReadManagedPerson(user, person) {
  return getUserRole(user) === "owner" || personGroupIds(person).some((id) => canManageGroup(user, id));
}

export function canEditManagedPerson(user, person) {
  if (getUserRole(user) === "owner") return true;
  const groups = personGroupIds(person);
  // Global profile changes affect every club sharing this person.
  return person.account_role === "user" && groups.length > 0 &&
    groups.every((id) => canManageGroup(user, id));
}
