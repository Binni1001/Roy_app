import type { AdminSchedule, PeriodSummary } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { managedGroup } from "./approvals.ts";
import { isDate } from "./availability.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import { NotFoundError } from "./extras.ts";
import { todayInVietnam } from "./matches.ts";
import { ValidationError } from "./profile.ts";

export type DayAction = "open" | "close" | "reopen";

export interface SessionInput {
  date: string;
  shuttles: number;
  note: string | null;
}

export interface AdminScheduleStore extends BootstrapStore {
  loadAdminSchedule(period: PeriodSummary, groupId: string): Promise<Omit<AdminSchedule, "period" | "notice">>;
  /** RPC mutate_open_play_day với quyền quản trị: mở, đóng hoặc mở lại đăng ký một ngày. */
  mutateDay(periodId: string, date: string, actorId: string, action: DayAction): Promise<void>;
  /** Kỳ của một buổi, null nếu không có buổi đó. */
  getSessionPeriodId(sessionId: string): Promise<string | null>;
  createSession(periodId: string, input: SessionInput): Promise<void>;
  updateSession(sessionId: string, input: SessionInput): Promise<void>;
  /** Xóa buổi chưa có khách; trả false nếu buổi còn khách. */
  deleteSession(sessionId: string): Promise<boolean>;
  getGuestSessionId(attendanceId: string): Promise<string | null>;
  /** Phí khách mặc định mỗi buổi của kỳ. */
  getGuestFee(periodId: string): Promise<number>;
  /** Các RPC v2_*_guest_attendance: ghi khách và phí khách trong một giao dịch. */
  addGuest(sessionId: string, personId: string, amount: number, note: string | null): Promise<boolean>;
  updateGuest(attendanceId: string, amount: number, note: string | null): Promise<boolean>;
  removeGuest(attendanceId: string): Promise<boolean>;
}

const body = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

function note(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length > 500) throw new ValidationError("Ghi chú tối đa 500 ký tự.");
  return value.trim() || null;
}

function amount(value: unknown, fallback: number): number {
  const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000_000) throw new ValidationError("Phí khách phải là số tiền nguyên, không âm.");
  return parsed;
}

export function parseSession(raw: unknown, period: PeriodSummary, today: string): SessionInput {
  const input = body(raw);
  if (!isDate(input.date)) throw new ValidationError("Chọn ngày chơi.");
  if (input.date < period.startDate || input.date > period.endDate) throw new ValidationError(`Ngày chơi phải nằm trong ${period.name}.`);
  if (input.date > today) throw new ValidationError("Chỉ ghi buổi đã chơi, không ghi trước ngày.");
  const shuttles = Number(input.shuttles ?? 0);
  if (!Number.isSafeInteger(shuttles) || shuttles < 0 || shuttles > 500) throw new ValidationError("Số quả cầu đã dùng phải là số nguyên không âm.");
  return { date: input.date, shuttles, note: note(input.note) };
}

/** Kỳ đang mở của nhóm owner đang xem. Lịch và điểm danh chỉ làm trên kỳ đang mở. */
async function context(user: AuthUser, store: AdminScheduleStore) {
  const groupId = await managedGroup(user, store);
  const period = await store.findOpenPeriod(groupId);
  return { groupId, period };
}

async function requireOpen(user: AuthUser, store: AdminScheduleStore) {
  const { groupId, period } = await context(user, store);
  if (!period) throw new ActionError("Chưa có kỳ đang mở.", 409, "NO_OPEN_PERIOD");
  return { groupId, period };
}

export async function loadSchedule(user: AuthUser, store: AdminScheduleStore, notice: string | null = null): Promise<AdminSchedule> {
  const { groupId, period } = await context(user, store);
  if (!period) return { period: null, guestFee: 0, settled: false, openDays: [], sessions: [], people: [], notice };
  return { period, ...(await store.loadAdminSchedule(period, groupId)), notice };
}

export async function changeDay(user: AuthUser, raw: unknown, store: AdminScheduleStore): Promise<AdminSchedule> {
  const { period } = await requireOpen(user, store);
  const input = body(raw);
  const action = input.action;
  if (action !== "open" && action !== "close" && action !== "reopen") throw new ValidationError("Thao tác không hợp lệ.");
  if (!isDate(input.date) || input.date < period.startDate || input.date > period.endDate) {
    throw new ValidationError(`Chọn một ngày trong ${period.name}.`);
  }
  await store.mutateDay(period.id, input.date, user.id, action);
  return loadSchedule(user, store);
}

/** Buổi phải thuộc kỳ đang mở của nhóm owner; buổi của kỳ khác hay nhóm khác báo là không tồn tại. */
async function ownSession(user: AuthUser, sessionId: string, store: AdminScheduleStore) {
  const { period } = await requireOpen(user, store);
  if ((await store.getSessionPeriodId(sessionId)) !== period.id) throw new NotFoundError();
  return period;
}

export async function addSession(user: AuthUser, raw: unknown, store: AdminScheduleStore): Promise<AdminSchedule> {
  const { period } = await requireOpen(user, store);
  await store.createSession(period.id, parseSession(raw, period, todayInVietnam()));
  return loadSchedule(user, store, "Đã ghi buổi chơi.");
}

export async function editSession(user: AuthUser, sessionId: string, raw: unknown, store: AdminScheduleStore): Promise<AdminSchedule> {
  const period = await ownSession(user, sessionId, store);
  await store.updateSession(sessionId, parseSession(raw, period, todayInVietnam()));
  return loadSchedule(user, store);
}

export async function removeSession(user: AuthUser, sessionId: string, store: AdminScheduleStore): Promise<AdminSchedule> {
  await ownSession(user, sessionId, store);
  if (!(await store.deleteSession(sessionId))) {
    throw new ActionError("Buổi này còn khách vãng lai. Xóa khách trước rồi mới xóa buổi.", 409, "SESSION_HAS_GUESTS");
  }
  return loadSchedule(user, store, "Đã xóa buổi.");
}

export async function addGuest(user: AuthUser, sessionId: string, raw: unknown, store: AdminScheduleStore): Promise<AdminSchedule> {
  const period = await ownSession(user, sessionId, store);
  const input = body(raw);
  if (typeof input.personId !== "string" || !input.personId) throw new ValidationError("Chọn người.");
  const fee = amount(input.amount, await store.getGuestFee(period.id));
  const created = await store.addGuest(sessionId, input.personId, fee, note(input.note));
  return loadSchedule(user, store, created ? "Đã ghi khách và tạo phí khách." : "Đã ghi khách (miễn phí).");
}

async function ownGuest(user: AuthUser, attendanceId: string, store: AdminScheduleStore) {
  const sessionId = await store.getGuestSessionId(attendanceId);
  if (!sessionId) throw new NotFoundError();
  await ownSession(user, sessionId, store);
}

export async function editGuest(user: AuthUser, attendanceId: string, raw: unknown, store: AdminScheduleStore): Promise<AdminSchedule> {
  await ownGuest(user, attendanceId, store);
  const input = body(raw);
  const changed = await store.updateGuest(attendanceId, amount(input.amount, Number.NaN), note(input.note));
  return loadSchedule(user, store, changed ? "Đã đổi phí khách." : null);
}

export async function deleteGuest(user: AuthUser, attendanceId: string, store: AdminScheduleStore): Promise<AdminSchedule> {
  await ownGuest(user, attendanceId, store);
  const cancelled = await store.removeGuest(attendanceId);
  return loadSchedule(user, store, cancelled ? "Đã xóa khách và hủy phí khách chưa trả." : "Đã xóa khách.");
}
