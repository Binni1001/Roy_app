import type { PendingMember } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { AccountInactiveError, pickActiveGroup, type BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { NoGroupError, NoProfileError } from "./member.ts";

export type Decision = "approve" | "reject";

export interface ApprovalStore extends BootstrapStore {
  listPendingMembers(groupId: string): Promise<PendingMember[]>;
  getMembershipStatus(personId: string, groupId: string): Promise<string | null>;
  /**
   * Duyệt: yêu cầu thành active; người chưa có nhóm nào thì nhóm này thành nhóm đang xem; hồ sơ thành active.
   * Từ chối: yêu cầu thành inactive; người không còn nhóm nào đang hoạt động thì hồ sơ thành inactive.
   * Giống bản cũ (groups.service.js). Trả false nếu yêu cầu đã được xử lý ở nơi khác.
   */
  decideMembership(personId: string, groupId: string, decision: Decision): Promise<boolean>;
}

/**
 * Như bản cũ, chỉ owner duyệt được yêu cầu vào nhóm. Nhóm được duyệt là nhóm owner đang xem.
 * Quyền theo từng nhóm (giai đoạn 5) sẽ thay điều kiện này.
 */
export async function managedGroup(user: AuthUser, store: BootstrapStore): Promise<string> {
  if (user.role !== "owner") throw new ActionError("Chỉ owner được làm việc này.", 403, "OWNER_ONLY");
  const person = await store.findPerson(user.email);
  if (!person) throw new NoProfileError();
  if (person.status === "inactive") throw new AccountInactiveError();
  const groupId = pickActiveGroup(
    person.active_group_id,
    person.person_groups.map((row) => ({
      groupId: row.group_id,
      groupName: row.groups?.name ?? "",
      role: row.member_role,
      status: row.status,
    })),
  );
  if (!groupId) throw new NoGroupError();
  return groupId;
}

export async function listPending(user: AuthUser, store: ApprovalStore): Promise<PendingMember[]> {
  return store.listPendingMembers(await managedGroup(user, store));
}

export async function decide(
  user: AuthUser,
  personId: string,
  decision: Decision,
  store: ApprovalStore,
): Promise<PendingMember[]> {
  const groupId = await managedGroup(user, store);
  const status = await store.getMembershipStatus(personId, groupId);
  // Người không xin vào nhóm này được báo là không tồn tại.
  if (status === null) throw new NotFoundError();
  if (status !== "pending" || !(await store.decideMembership(personId, groupId, decision))) {
    throw new ActionError("Yêu cầu này đã được xử lý. Tải lại danh sách.", 409, "REQUEST_DECIDED");
  }
  return store.listPendingMembers(groupId);
}
