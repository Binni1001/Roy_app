import type { Bootstrap, InviteCheck } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { AccountInactiveError, loadBootstrap, type BootstrapStore } from "./bootstrap.ts";
import { ValidationError } from "./profile.ts";

/** Một người tham gia tối đa ba nhóm (đang chờ hoặc đang hoạt động), như bản cũ. */
export const MAX_GROUPS = 3;

export interface OnboardingStore extends BootstrapStore {
  /** Nhóm có mã mời này, không phân biệt hoa thường. */
  findGroupByCode(code: string): Promise<{ id: string; name: string } | null>;
  /**
   * Tạo hồ sơ đang chờ duyệt cho tài khoản mới và yêu cầu vào nhóm.
   * Nếu không tạo được yêu cầu vào nhóm thì phải gỡ hồ sơ vừa tạo, không để hồ sơ mồ côi.
   */
  createPendingPerson(input: { email: string; fullName: string; groupId: string }): Promise<void>;
  /** Thêm yêu cầu vào nhóm ở trạng thái chờ duyệt, vai trò thành viên. */
  requestMembership(personId: string, groupId: string): Promise<void>;
  setActiveGroup(personId: string, groupId: string): Promise<void>;
}

/** Mã mời gồm chữ và số, 4 đến 16 ký tự; chữ được đổi sang in hoa. */
export function parseInviteCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{4,16}$/.test(code)) throw new ValidationError("Mã mời gồm 4 đến 16 chữ hoặc số.");
  return code;
}

function parseFullName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80) throw new ValidationError("Nhập họ tên từ 2 đến 80 ký tự.");
  return name;
}

const wrongCode = () => new ActionError("Mã mời không đúng. Kiểm tra lại với quản trị viên.", 404, "INVITE_NOT_FOUND");

export async function checkInvite(body: unknown, store: OnboardingStore): Promise<InviteCheck> {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const group = await store.findGroupByCode(parseInviteCode(raw.code));
  if (!group) throw wrongCode();
  return { groupName: group.name };
}

/**
 * Tham gia nhóm bằng mã mời. Tài khoản chưa có hồ sơ thì tạo hồ sơ đang chờ duyệt.
 * Mọi yêu cầu đều chờ quản trị viên của nhóm duyệt; không ai tự vào thẳng được.
 */
export async function joinGroup(user: AuthUser, body: unknown, store: OnboardingStore): Promise<Bootstrap> {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const code = parseInviteCode(raw.code);
  const person = await store.findPerson(user.email);
  if (person?.status === "inactive") throw new AccountInactiveError();
  // Kiểm tra họ tên trước khi tra mã, để form báo lỗi nhập liệu trước.
  const fullName = person ? null : parseFullName(raw.fullName);

  const group = await store.findGroupByCode(code);
  if (!group) throw wrongCode();

  if (!person) {
    await store.createPendingPerson({ email: user.email, fullName: fullName!, groupId: group.id });
    return loadBootstrap(user, store);
  }

  const existing = person.person_groups.find((row) => row.group_id === group.id);
  if (existing) {
    const message =
      existing.status === "pending"
        ? "Yêu cầu vào nhóm này đang chờ duyệt."
        : existing.status === "active"
          ? "Bạn đã ở trong nhóm này."
          : "Bạn đã rời nhóm này. Liên hệ quản trị viên để vào lại.";
    throw new ActionError(message, 409, "ALREADY_MEMBER");
  }
  const current = person.person_groups.filter((row) => row.status !== "inactive").length;
  if (current >= MAX_GROUPS) {
    throw new ActionError(`Bạn đã ở ${MAX_GROUPS} nhóm. Rời một nhóm trước khi vào nhóm mới.`, 409, "TOO_MANY_GROUPS");
  }
  await store.requestMembership(person.id, group.id);
  return loadBootstrap(user, store);
}

/** Đổi nhóm đang xem. Chỉ chọn được nhóm mình đang hoạt động trong đó. */
export async function switchGroup(user: AuthUser, body: unknown, store: OnboardingStore): Promise<Bootstrap> {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const groupId = typeof raw.groupId === "string" ? raw.groupId : "";
  const person = await store.findPerson(user.email);
  if (!person) throw new ActionError("Tài khoản chưa có hồ sơ người chơi.", 409, "NO_PROFILE");
  if (person.status === "inactive") throw new AccountInactiveError();
  const membership = person.person_groups.find((row) => row.group_id === groupId);
  if (!membership || membership.status !== "active") {
    throw new ActionError("Bạn chưa được duyệt vào nhóm này.", 403, "NOT_A_MEMBER");
  }
  await store.setActiveGroup(person.id, groupId);
  return loadBootstrap(user, store);
}
