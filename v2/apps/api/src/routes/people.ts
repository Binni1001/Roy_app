import type { ManagedPerson, PersonInput } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { ValidationError } from "./profile.ts";

export interface PeopleStore extends BootstrapStore {
  /** Người đang chơi hoặc đã nghỉ trong nhóm (không gồm người đang chờ duyệt). */
  listGroupPeople(groupId: string): Promise<ManagedPerson[]>;
  /** id hồ sơ có email này (không phân biệt hoa thường), hoặc null. */
  findPersonIdByEmail(email: string): Promise<string | null>;
  /** Trạng thái của người đó trong nhóm, null khi không thuộc nhóm. */
  getMembershipStatus(personId: string, groupId: string): Promise<string | null>;
  /** Tạo hồ sơ đang hoạt động và cho vào nhóm ngay; lỗi giữa chừng thì gỡ hồ sơ vừa tạo. */
  createMember(groupId: string, input: PersonInput): Promise<void>;
  updatePerson(personId: string, input: PersonInput): Promise<void>;
  /**
   * Cho nghỉ: rời nhóm này; không còn nhóm nào đang chơi thì hồ sơ thành đã nghỉ.
   * Cho chơi lại: vào lại nhóm, hồ sơ thành đang hoạt động; chưa có nhóm đang xem thì lấy nhóm này.
   */
  setMemberStatus(personId: string, groupId: string, status: "active" | "inactive"): Promise<void>;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

function text(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ValidationError(`${label} không hợp lệ.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length > max) throw new ValidationError(`${label} dài tối đa ${max} ký tự.`);
  return cleaned || null;
}

/** Giống kiểm tra của bản cũ, gọn lại: họ tên bắt buộc, còn lại không bắt buộc. */
export function parsePersonInput(body: unknown): PersonInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Dữ liệu gửi lên không hợp lệ.");
  const raw = body as Record<string, unknown>;
  const fullName = text(raw.fullName, "Họ tên", 100);
  if (!fullName || fullName.length < 2) throw new ValidationError("Nhập họ tên, ít nhất 2 ký tự.");
  const nickname = text(raw.nickname, "Biệt danh", 50);
  const email = text(raw.email, "Email", 254)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new ValidationError("Email chưa đúng dạng, ví dụ ten@gmail.com.");
  const phone = text(raw.phone, "Số điện thoại", 20)?.replace(/[\s.-]/g, "") ?? null;
  if (phone && !/^\+?\d{9,12}$/.test(phone)) throw new ValidationError("Số điện thoại gồm 9 đến 12 chữ số.");
  // Cố định hay vãng lai không chọn ở đây: có tên trong kỳ đang mở là cố định (màn hình Kỳ quỹ).
  return { fullName, nickname, email, phone };
}

async function assertEmailFree(store: PeopleStore, email: string | null, personId: string | null) {
  if (!email) return;
  const owner = await store.findPersonIdByEmail(email);
  if (owner && owner !== personId) {
    throw new ActionError("Email này đã gắn với một hồ sơ khác.", 409, "EMAIL_TAKEN");
  }
}

async function memberOfGroup(store: PeopleStore, personId: string, groupId: string): Promise<string> {
  const status = await store.getMembershipStatus(personId, groupId);
  // Người của nhóm khác, hoặc đang chờ duyệt, không sửa ở đây.
  if (status !== "active" && status !== "inactive") throw new NotFoundError();
  return status;
}

export async function listPeople(user: AuthUser, store: PeopleStore): Promise<ManagedPerson[]> {
  return store.listGroupPeople(await managedGroup(user, store));
}

export async function addPerson(user: AuthUser, body: unknown, store: PeopleStore): Promise<ManagedPerson[]> {
  const groupId = await managedGroup(user, store);
  const input = parsePersonInput(body);
  await assertEmailFree(store, input.email, null);
  await store.createMember(groupId, input);
  return store.listGroupPeople(groupId);
}

export async function editPerson(user: AuthUser, personId: string, body: unknown, store: PeopleStore): Promise<ManagedPerson[]> {
  const groupId = await managedGroup(user, store);
  await memberOfGroup(store, personId, groupId);
  const input = parsePersonInput(body);
  await assertEmailFree(store, input.email, personId);
  await store.updatePerson(personId, input);
  return store.listGroupPeople(groupId);
}

export async function changeStatus(user: AuthUser, personId: string, body: unknown, store: PeopleStore): Promise<ManagedPerson[]> {
  const groupId = await managedGroup(user, store);
  const status = (body && typeof body === "object" ? (body as Record<string, unknown>).status : null) as unknown;
  if (status !== "active" && status !== "inactive") throw new ValidationError("Trạng thái phải là đang chơi hoặc đã nghỉ.");
  const current = await memberOfGroup(store, personId, groupId);
  if (status === "inactive") {
    const me = await store.findPerson(user.email);
    if (me?.id === personId) throw new ActionError("Không tự cho mình nghỉ được.", 409, "SELF");
  }
  if (current !== status) await store.setMemberStatus(personId, groupId, status);
  return store.listGroupPeople(groupId);
}
