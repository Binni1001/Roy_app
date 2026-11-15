import type { BuyType, ExpenseInput, LoanInput, PeriodSummary, ShuttleOverview } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import { FIXED_POINTS_RULE } from "./arena.ts";
import { isDate } from "./availability.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { todayInVietnam } from "./matches.ts";
import { ValidationError } from "./profile.ts";

export interface ShuttleStore extends BootstrapStore {
  loadShuttleOverview(period: PeriodSummary, groupId: string): Promise<Omit<ShuttleOverview, "period" | "notice">>;
  /** RPC create_shuttle_expense_with_fund: chi cầu, tách phần quỹ chi vào sổ quỹ, trong một giao dịch. */
  createExpense(periodId: string, input: ExpenseInput): Promise<void>;
  getExpensePeriodId(id: string): Promise<string | null>;
  /** Xóa chi cầu; trigger của database từ chối khi kỳ đã chốt hoặc khoản đã được quỹ bù. */
  deleteExpense(id: string): Promise<void>;
  /** RPC create_shuttle_loan / repay_shuttle_loan / cancel_shuttle_loan. */
  createLoan(periodId: string, input: LoanInput): Promise<void>;
  getLoanPeriodId(id: string): Promise<string | null>;
  changeLoan(id: string, action: "repay" | "cancel"): Promise<void>;
  /** RPC apply_fund_to_shuttles: dùng quỹ dư bù cho người đã mua cầu. */
  applyFund(periodId: string, buyerId: string, amount: number): Promise<void>;
  /** RPC settle_shuttle_period, rồi gửi thông báo kết quả cho từng người (lỗi gửi thông báo bỏ qua, như bản cũ). */
  settle(periodId: string, periodName: string): Promise<void>;
  getScoringRule(periodId: string): Promise<string | null>;
  /** Lấy chữ ký trận, dựng bảng xếp hạng đơn và đôi theo định dạng bản cũ, rồi gọi close_period_with_pk_history. */
  closePeriod(periodId: string): Promise<void>;
}

const body = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const int = (value: unknown, label: string, min = 0, max = 100_000_000) => {
  const n = value === undefined || value === null || value === "" ? 0 : Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new ValidationError(`${label} phải là số nguyên từ ${min}.`);
  return n;
};
const text = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length > 500) throw new ValidationError("Ghi chú tối đa 500 ký tự.");
  return value.trim() || null;
};

/** Giống validateBuyTypeAndCounts và createWithFundSplit của bản cũ. */
export function parseExpense(raw: unknown, today: string): ExpenseInput {
  const input = body(raw);
  if (typeof input.buyerId !== "string" || !input.buyerId) throw new ValidationError("Chọn người mua cầu.");
  const buyType = (input.buyType ?? "tube") as BuyType;
  if (!["tube", "single", "mixed"].includes(buyType)) throw new ValidationError("Chọn mua theo ống, lẻ hoặc cả hai.");
  const tubeCount = int(input.tubeCount, "Số ống");
  const shuttlePerTube = int(input.shuttlePerTube ?? 12, "Số quả mỗi ống", 1, 100);
  const singleCount = int(input.singleCount, "Số quả lẻ");
  if (buyType === "tube" && tubeCount <= 0) throw new ValidationError("Mua theo ống thì số ống phải lớn hơn 0.");
  if (buyType === "single" && singleCount <= 0) throw new ValidationError("Mua lẻ thì số quả lẻ phải lớn hơn 0.");
  if (buyType === "mixed" && tubeCount <= 0 && singleCount <= 0) throw new ValidationError("Nhập số ống hoặc số quả lẻ.");
  const totalPrice = int(input.totalPrice, "Tổng giá", 1);
  const fundAmount = int(input.fundAmount, "Phần quỹ chi");
  if (fundAmount > totalPrice) throw new ValidationError("Phần quỹ chi không được lớn hơn tổng giá.");
  const buyDate = input.buyDate ?? today;
  if (!isDate(buyDate) || buyDate > today) throw new ValidationError("Ngày mua không được ở tương lai.");
  return { buyerId: input.buyerId, buyType, tubeCount, shuttlePerTube, singleCount, totalPrice, fundAmount, buyDate, note: text(input.note) };
}

export function parseLoan(raw: unknown, today: string): LoanInput {
  const input = body(raw);
  if (typeof input.personId !== "string" || !input.personId) throw new ValidationError("Chọn người mượn cầu.");
  const quantity = int(input.quantity, "Số quả", 1, 1000);
  const unitPrice = int(input.unitPrice, "Giá mỗi quả", 1, 1_000_000);
  const borrowedAt = input.borrowedAt ?? today;
  if (!isDate(borrowedAt) || borrowedAt > today) throw new ValidationError("Ngày mượn không được ở tương lai.");
  return { personId: input.personId, quantity, unitPrice, borrowedAt, note: text(input.note) };
}

async function context(user: AuthUser, store: ShuttleStore) {
  const groupId = await managedGroup(user, store);
  return { groupId, period: await store.findOpenPeriod(groupId) };
}

async function requireOpen(user: AuthUser, store: ShuttleStore) {
  const { groupId, period } = await context(user, store);
  if (!period) throw new ActionError("Chưa có kỳ đang mở.", 409, "NO_OPEN_PERIOD");
  return { groupId, period };
}

export async function loadShuttles(user: AuthUser, store: ShuttleStore, notice: string | null = null): Promise<ShuttleOverview> {
  const { groupId, period } = await context(user, store);
  if (!period) {
    return {
      period: null,
      expenses: [],
      loans: [],
      buyers: [],
      people: [],
      settlement: { settled: false, totalAmount: 0, totalShuttles: 0, memberCount: 0, lines: [], fundBalance: 0, blocking: [], canSettle: false, problem: null },
      canClose: false,
      closeSupported: false,
      notice,
    };
  }
  return { period, ...(await store.loadShuttleOverview(period, groupId)), notice };
}

export async function addExpense(user: AuthUser, raw: unknown, store: ShuttleStore) {
  const { period } = await requireOpen(user, store);
  await store.createExpense(period.id, parseExpense(raw, todayInVietnam()));
  return loadShuttles(user, store, "Đã ghi lần mua cầu.");
}

export async function removeExpense(user: AuthUser, id: string, store: ShuttleStore) {
  const { period } = await requireOpen(user, store);
  if ((await store.getExpensePeriodId(id)) !== period.id) throw new NotFoundError();
  await store.deleteExpense(id);
  return loadShuttles(user, store, "Đã xóa lần mua cầu.");
}

export async function addLoan(user: AuthUser, raw: unknown, store: ShuttleStore) {
  const { period } = await requireOpen(user, store);
  await store.createLoan(period.id, parseLoan(raw, todayInVietnam()));
  return loadShuttles(user, store, "Đã ghi khoản mượn cầu.");
}

export async function changeLoan(user: AuthUser, id: string, action: string, store: ShuttleStore) {
  if (action !== "repay" && action !== "cancel") throw new NotFoundError();
  const { period } = await requireOpen(user, store);
  if ((await store.getLoanPeriodId(id)) !== period.id) throw new NotFoundError();
  await store.changeLoan(id, action);
  return loadShuttles(user, store, action === "repay" ? "Đã ghi nhận trả tiền mượn cầu vào quỹ." : "Đã hủy khoản mượn cầu.");
}

export async function useFund(user: AuthUser, raw: unknown, store: ShuttleStore) {
  const { period } = await requireOpen(user, store);
  const input = body(raw);
  if (typeof input.buyerId !== "string" || !input.buyerId) throw new ValidationError("Chọn người nhận tiền quỹ.");
  const amount = int(input.amount, "Số tiền", 1);
  await store.applyFund(period.id, input.buyerId, amount);
  return loadShuttles(user, store, "Đã dùng quỹ dư bù tiền cầu.");
}

export async function settleShuttles(user: AuthUser, store: ShuttleStore) {
  const { period } = await requireOpen(user, store);
  await store.settle(period.id, period.name);
  return loadShuttles(user, store, "Đã chốt chia tiền cầu và gửi thông báo cho từng người.");
}

export async function closeOpenPeriod(user: AuthUser, store: ShuttleStore) {
  const { period } = await requireOpen(user, store);
  if ((await store.getScoringRule(period.id)) !== FIXED_POINTS_RULE) {
    throw new ActionError("Kỳ này dùng luật xếp hạng cũ; đóng kỳ ở bản cũ.", 409, "CLOSE_UNSUPPORTED");
  }
  await store.closePeriod(period.id);
  return loadShuttles(user, store, `Đã đóng ${period.name}. Bảng xếp hạng của kỳ đã được lưu.`);
}
