import type { AdminPeriod, MoneyOverview, PeriodReport, PeriodSummary } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { ValidationError } from "./profile.ts";

export interface MoneyStore extends BootstrapStore {
  loadMoney(period: PeriodSummary, groupId: string): Promise<Omit<MoneyOverview, "period" | "notice">>;
  /** Khoản nợ chưa trả của nhóm: người nợ và kỳ; null nếu không có, đã trả hoặc thuộc nhóm khác. */
  getUnpaidDebt(debtId: string, groupId: string): Promise<{ personId: string } | null>;
  isActiveInGroup(personId: string, groupId: string): Promise<boolean>;
  /** RPC deposit_fund_atomic: đánh dấu các khoản đã trả và ghi thu vào quỹ của kỳ trong một giao dịch. */
  collect(periodId: string, personId: string, amount: number, debtIds: string[], note: string | null): Promise<void>;
  /** Một câu lệnh: thêm khoản thu tay (loại other). Trigger tự bù số dư như mọi khoản nợ mới. */
  addDebt(periodId: string, personId: string, amount: number, description: string): Promise<void>;
  /** Một câu lệnh: hủy khoản nợ chỉ khi còn chưa trả; trả false nếu đã đổi. */
  cancelDebt(debtId: string): Promise<boolean>;
  /** Gửi thông báo nhắc nợ liệt kê các khoản chưa trả trong nhóm. Trả số khoản đã nhắc. */
  remind(personId: string, groupId: string): Promise<number>;
  /** Một câu lệnh: ghi chi quỹ của kỳ. */
  addExpense(periodId: string, personId: string | null, amount: number, description: string): Promise<void>;
  /** RPC refund_person_balance: hoàn số dư cho thành viên, ghi cả sổ số dư và sổ quỹ. */
  refund(periodId: string, personId: string, amount: number, description: string): Promise<void>;
  getPeriodForReport(periodId: string): Promise<(AdminPeriod & { groupId: string | null }) | null>;
  buildReport(period: AdminPeriod, groupId: string): Promise<PeriodReport>;
}

const body = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const amountOf = (value: unknown) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 100_000_000) throw new ValidationError("Số tiền phải là số nguyên lớn hơn 0.");
  return n;
};
const description = (value: unknown, required: boolean) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > 500) throw new ValidationError("Mô tả tối đa 500 ký tự.");
  if (required && !text) throw new ValidationError("Nhập mô tả để mọi người hiểu khoản này là gì.");
  return text || null;
};
const personIdOf = (value: unknown) => {
  if (typeof value !== "string" || !value) throw new ValidationError("Chọn người.");
  return value;
};

async function context(user: AuthUser, store: MoneyStore) {
  const groupId = await managedGroup(user, store);
  return { groupId, period: await store.findOpenPeriod(groupId) };
}

async function requireOpen(user: AuthUser, store: MoneyStore) {
  const { groupId, period } = await context(user, store);
  if (!period) throw new ActionError("Chưa có kỳ đang mở để ghi tiền.", 409, "NO_OPEN_PERIOD");
  return { groupId, period };
}

async function requireMember(store: MoneyStore, personId: string, groupId: string) {
  if (!(await store.isActiveInGroup(personId, groupId))) throw new ValidationError("Người này không còn hoạt động trong nhóm.");
}

export async function loadMoney(user: AuthUser, store: MoneyStore, notice: string | null = null): Promise<MoneyOverview> {
  const { groupId, period } = await context(user, store);
  if (!period) {
    return {
      period: null,
      unpaid: [],
      unpaidTotal: 0,
      fund: { income: 0, expense: 0, refund: 0, adjustment: 0, balance: 0, entries: [] },
      people: [],
      notice,
    };
  }
  return { period, ...(await store.loadMoney(period, groupId)), notice };
}

export async function collect(user: AuthUser, raw: unknown, store: MoneyStore) {
  const { groupId, period } = await requireOpen(user, store);
  const input = body(raw);
  const personId = personIdOf(input.personId);
  const debtIds = Array.isArray(input.debtIds) ? [...new Set(input.debtIds)] : [];
  if (debtIds.some((id) => typeof id !== "string" || !id) || debtIds.length > 100) throw new ValidationError("Danh sách khoản nợ không hợp lệ.");
  for (const id of debtIds as string[]) {
    const debt = await store.getUnpaidDebt(id, groupId);
    if (!debt || debt.personId !== personId) throw new ActionError("Có khoản đã được trả hoặc không thuộc người này. Tải lại.", 409, "DEBT_CHANGED");
  }
  await requireMember(store, personId, groupId);
  const amount = amountOf(input.amount);
  await store.collect(period.id, personId, amount, debtIds as string[], description(input.note, false));
  return loadMoney(user, store, debtIds.length ? `Đã thu ${debtIds.length} khoản và ghi vào quỹ.` : "Đã ghi tiền nộp quỹ.");
}

export async function addDebt(user: AuthUser, raw: unknown, store: MoneyStore) {
  const { groupId, period } = await requireOpen(user, store);
  const input = body(raw);
  const personId = personIdOf(input.personId);
  await requireMember(store, personId, groupId);
  await store.addDebt(period.id, personId, amountOf(input.amount), description(input.description, true)!);
  return loadMoney(user, store, "Đã thêm khoản thu.");
}

export async function cancelDebt(user: AuthUser, debtId: string, store: MoneyStore) {
  const { groupId } = await requireOpen(user, store);
  if (!(await store.getUnpaidDebt(debtId, groupId))) throw new NotFoundError();
  if (!(await store.cancelDebt(debtId))) throw new ActionError("Khoản này vừa thay đổi. Tải lại.", 409, "DEBT_CHANGED");
  return loadMoney(user, store, "Đã hủy khoản nợ.");
}

export async function remind(user: AuthUser, personId: string, store: MoneyStore) {
  const { groupId } = await requireOpen(user, store);
  const count = await store.remind(personId, groupId);
  if (!count) throw new ActionError("Người này không còn khoản nào chưa trả.", 409, "NOTHING_TO_REMIND");
  return loadMoney(user, store, "Đã gửi thông báo nhắc nợ.");
}

export async function addFund(user: AuthUser, raw: unknown, store: MoneyStore) {
  const { groupId, period } = await requireOpen(user, store);
  const input = body(raw);
  const amount = amountOf(input.amount);
  if (input.type === "income") {
    const personId = personIdOf(input.personId);
    await requireMember(store, personId, groupId);
    await store.collect(period.id, personId, amount, [], description(input.description, false));
    return loadMoney(user, store, "Đã ghi tiền nộp quỹ.");
  }
  if (input.type === "expense") {
    const personId = input.personId ? personIdOf(input.personId) : null;
    if (personId) await requireMember(store, personId, groupId);
    await store.addExpense(period.id, personId, amount, description(input.description, true)!);
    return loadMoney(user, store, "Đã ghi khoản chi quỹ.");
  }
  if (input.type === "refund") {
    const personId = personIdOf(input.personId);
    await requireMember(store, personId, groupId);
    await store.refund(period.id, personId, amount, description(input.description, false) ?? "Hoàn tiền số dư cho thành viên");
    return loadMoney(user, store, "Đã hoàn tiền số dư.");
  }
  throw new ValidationError("Chọn thu, chi hoặc hoàn tiền.");
}

export async function periodReport(user: AuthUser, periodId: string, store: MoneyStore): Promise<PeriodReport> {
  const groupId = await managedGroup(user, store);
  const period = await store.getPeriodForReport(periodId);
  if (!period || period.groupId !== groupId) throw new NotFoundError();
  const { groupId: _ignored, ...plain } = period;
  return store.buildReport(plain, groupId);
}
