import type { AdminPeriod, PeriodInput, PeriodMemberStatus, PeriodRoster, ShuttleDiscount } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import { isDate } from "./availability.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { ValidationError } from "./profile.ts";

export type FeeAction = "none" | "fee_created" | "fee_cancelled" | "fee_paid_refund_needed";

export interface PeriodsStore extends BootstrapStore {
  listPeriods(groupId: string): Promise<AdminPeriod[]>;
  getPeriod(id: string): Promise<(AdminPeriod & { groupId: string | null }) | null>;
  createPeriod(groupId: string, input: PeriodInput): Promise<void>;
  updatePeriod(id: string, input: PeriodInput): Promise<void>;
  /** Đổi trạng thái kỳ; trigger của database kiểm tra mở kỳ (chỉ một kỳ mở, quỹ kỳ trước bằng 0). */
  setPeriodStatus(id: string, status: "open"): Promise<void>;
  getRoster(period: AdminPeriod, groupId: string): Promise<Omit<PeriodRoster, "notice">>;
  /** RPC v2_add_period_members: thêm người và tạo nợ phí cố định trong một giao dịch. */
  addPeriodMembers(periodId: string, personIds: string[]): Promise<{ added: number; skipped: number; feesCreated: number }>;
  getPeriodMemberPeriodId(memberId: string): Promise<string | null>;
  /** RPC v2_update_period_member: đổi trạng thái và mức miễn, tạo hoặc hủy nợ phí cố định trong một giao dịch. */
  updatePeriodMember(memberId: string, status: PeriodMemberStatus, discount: ShuttleDiscount): Promise<FeeAction>;
}

const MAX_FEE = 100_000_000;

function fee(value: unknown, label: string): number {
  const amount = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (amount === undefined || amount === null || amount === "") return 0;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_FEE) {
    throw new ValidationError(`${label} phải là số tiền nguyên, không âm.`);
  }
  return amount;
}

export function parsePeriodInput(body: unknown): PeriodInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Dữ liệu gửi lên không hợp lệ.");
  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 100) throw new ValidationError("Nhập tên kỳ, tối đa 100 ký tự.");
  if (!isDate(raw.startDate) || !isDate(raw.endDate)) throw new ValidationError("Chọn ngày bắt đầu và ngày kết thúc.");
  if (raw.endDate < raw.startDate) throw new ValidationError("Ngày kết thúc không được trước ngày bắt đầu.");
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length > 500) throw new ValidationError("Ghi chú tối đa 500 ký tự.");
  return {
    name,
    startDate: raw.startDate,
    endDate: raw.endDate,
    fixedMemberFee: fee(raw.fixedMemberFee, "Phí cố định"),
    guestFeePerSession: fee(raw.guestFeePerSession, "Phí khách mỗi buổi"),
    note: note || null,
  };
}

/** Kỳ của chính nhóm owner đang xem; kỳ nhóm khác báo là không tồn tại. */
async function ownPeriod(store: PeriodsStore, id: string, groupId: string) {
  const period = await store.getPeriod(id);
  if (!period || period.groupId !== groupId) throw new NotFoundError();
  return period;
}

export async function listPeriods(user: AuthUser, store: PeriodsStore): Promise<AdminPeriod[]> {
  return store.listPeriods(await managedGroup(user, store));
}

export async function createPeriod(user: AuthUser, body: unknown, store: PeriodsStore): Promise<AdminPeriod[]> {
  const groupId = await managedGroup(user, store);
  // Kỳ mới luôn là bản nháp; mở kỳ là bước riêng để database kiểm tra điều kiện.
  await store.createPeriod(groupId, parsePeriodInput(body));
  return store.listPeriods(groupId);
}

export async function editPeriod(user: AuthUser, id: string, body: unknown, store: PeriodsStore): Promise<AdminPeriod[]> {
  const groupId = await managedGroup(user, store);
  const period = await ownPeriod(store, id, groupId);
  if (period.status === "closed") throw new ActionError("Kỳ đã đóng, không sửa được.", 409, "PERIOD_CLOSED");
  await store.updatePeriod(id, parsePeriodInput(body));
  return store.listPeriods(groupId);
}

export async function openPeriod(user: AuthUser, id: string, store: PeriodsStore): Promise<AdminPeriod[]> {
  const groupId = await managedGroup(user, store);
  const period = await ownPeriod(store, id, groupId);
  if (period.status !== "draft") throw new ActionError("Chỉ mở được kỳ đang ở bản nháp.", 409, "PERIOD_NOT_DRAFT");
  await store.setPeriodStatus(id, "open");
  return store.listPeriods(groupId);
}

export async function loadRoster(user: AuthUser, id: string, store: PeriodsStore, notice: string | null = null): Promise<PeriodRoster> {
  const groupId = await managedGroup(user, store);
  const period = await ownPeriod(store, id, groupId);
  return { ...(await store.getRoster(period, groupId)), notice };
}

export async function addMembers(user: AuthUser, id: string, body: unknown, store: PeriodsStore): Promise<PeriodRoster> {
  const groupId = await managedGroup(user, store);
  const period = await ownPeriod(store, id, groupId);
  const raw = (body && typeof body === "object" ? (body as Record<string, unknown>).personIds : null) as unknown;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100 || raw.some((x) => typeof x !== "string" || !x)) {
    throw new ValidationError("Chọn từ 1 đến 100 người.");
  }
  if (period.status === "closed") throw new ActionError("Kỳ đã đóng, không thêm người được.", 409, "PERIOD_CLOSED");
  const result = await store.addPeriodMembers(id, [...new Set(raw as string[])]);
  const parts = [`Đã thêm ${result.added} người`];
  if (result.feesCreated) parts.push(`tạo ${result.feesCreated} khoản phí cố định`);
  if (result.skipped) parts.push(`bỏ qua ${result.skipped} người đã có trong kỳ`);
  return { ...(await store.getRoster(period, groupId)), notice: parts.join(", ") + "." };
}

const NOTICES: Record<FeeAction, string | null> = {
  none: null,
  fee_created: "Đã tạo khoản phí cố định cho người này.",
  fee_cancelled: "Đã hủy khoản phí cố định chưa trả của người này.",
  fee_paid_refund_needed: "Người này đã trả phí cố định. Nếu cần, hoàn tiền bằng tay ở sổ quỹ.",
};

export async function changeMember(user: AuthUser, memberId: string, body: unknown, store: PeriodsStore): Promise<PeriodRoster> {
  const groupId = await managedGroup(user, store);
  const periodId = await store.getPeriodMemberPeriodId(memberId);
  if (!periodId) throw new NotFoundError();
  const period = await ownPeriod(store, periodId, groupId);
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const status = raw.status;
  const discount = Number(raw.discountPercent);
  // Trong kỳ là cố định; rời kỳ là inactive. Không có "vãng lai trong kỳ".
  if (status !== "fixed" && status !== "inactive") throw new ValidationError("Chỉ có thể ở trong kỳ hoặc rời kỳ.");
  if (discount !== 0 && discount !== 50 && discount !== 100) throw new ValidationError("Mức miễn tiền cầu chỉ là 0%, 50% hoặc 100%.");
  if (period.status === "closed") throw new ActionError("Kỳ đã đóng, không sửa được.", 409, "PERIOD_CLOSED");
  if (period.settled) throw new ActionError("Kỳ đã chốt chia tiền cầu, không đổi trạng thái hay mức miễn được.", 409, "PERIOD_SETTLED");
  const action = await store.updatePeriodMember(memberId, status, discount);
  return { ...(await store.getRoster(period, groupId)), notice: NOTICES[action] };
}
