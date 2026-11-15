import type {
  Bootstrap,
  Membership,
  MemberRole,
  MembershipStatus,
  PeriodSummary,
} from "@roy/shared";
import type { AuthUser } from "../auth.ts";

export interface PersonRow {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
  active_group_id: string | null;
  person_groups: {
    group_id: string;
    status: MembershipStatus;
    member_role: MemberRole;
    groups: { id: string; name: string } | null;
  }[];
}

export interface BootstrapStore {
  findPerson(email: string): Promise<PersonRow | null>;
  findOpenPeriod(groupId: string): Promise<PeriodSummary | null>;
}

export class AccountInactiveError extends Error {}

/** Chọn nhóm đang xem: ưu tiên nhóm người dùng đã chọn, nếu nhóm đó còn hiệu lực. */
export function pickActiveGroup(
  activeGroupId: string | null,
  memberships: Membership[],
): string | null {
  const active = memberships.filter((m) => m.status === "active");
  return active.find((m) => m.groupId === activeGroupId)?.groupId ?? active[0]?.groupId ?? null;
}

export async function loadBootstrap(user: AuthUser, store: BootstrapStore): Promise<Bootstrap> {
  const person = await store.findPerson(user.email);
  if (!person) return { me: null, memberships: [], openPeriod: null };
  if (person.status === "inactive") throw new AccountInactiveError();

  const memberships: Membership[] = [];
  for (const row of person.person_groups) {
    if (!row.groups) continue;
    memberships.push({
      groupId: row.group_id,
      groupName: row.groups.name,
      role: row.member_role,
      status: row.status,
    });
  }

  const activeGroupId = pickActiveGroup(person.active_group_id, memberships);
  const openPeriod = activeGroupId ? await store.findOpenPeriod(activeGroupId) : null;

  return {
    me: {
      id: person.id,
      fullName: person.full_name,
      nickname: person.nickname,
      avatarUrl: person.avatar_url,
      activeGroupId,
    },
    memberships,
    openPeriod,
  };
}
