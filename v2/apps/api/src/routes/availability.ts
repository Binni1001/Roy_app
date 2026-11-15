import type { Availability, AvailabilityInput, DayOverride, IsoWeekday, PeriodSummary } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import type { BootstrapStore } from "./bootstrap.ts";
import type { Member } from "./member.ts";
import { ValidationError } from "./profile.ts";

/** Giống SCHEDULE_RULES của bản cũ (backend/src/modules/session-planning/sessionPlanning.rules.js). */
export const PLAYING_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 5, 6, 7];
const MAX_OVERRIDES = 370;

export interface StoredPreferences {
  busyWeekdays: number[];
  dateOverrides: Record<string, string>;
  revision: number;
}

export interface AvailabilityStore extends BootstrapStore {
  isFixedMember(periodId: string, personId: string): Promise<boolean>;
  getPreferences(periodId: string, personId: string): Promise<StoredPreferences | null>;
  /** Ngày tự đăng ký của kỳ; những ngày này không tính là ngày chơi cố định. */
  listOpenDayDates(periodId: string): Promise<string[]>;
  /**
   * Gọi RPC save_session_planning_preferences. Database kiểm tra lại quyền, tư cách thành viên
   * cố định, trạng thái kỳ và revision trong cùng một giao dịch.
   */
  savePreferences(periodId: string, personId: string, actorId: string, input: AvailabilityInput): Promise<void>;
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function weekday(date: string): IsoWeekday {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() || 7) as IsoWeekday;
}

/** Ngày chơi cố định trong kỳ: đúng các thứ có lịch, bỏ ngày tự đăng ký. */
export function playDates(period: PeriodSummary, openDates: string[]): string[] {
  const skip = new Set(openDates);
  const dates: string[] = [];
  const cursor = new Date(`${period.startDate}T00:00:00Z`);
  const end = new Date(`${period.endDate}T00:00:00Z`);
  // Kỳ dài bất thường không được làm treo máy chủ.
  for (let i = 0; cursor <= end && i < 400; i++) {
    const date = cursor.toISOString().slice(0, 10);
    if (PLAYING_WEEKDAYS.includes(weekday(date)) && !skip.has(date)) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function parseAvailability(body: unknown, period: PeriodSummary): AvailabilityInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Dữ liệu lịch bận không hợp lệ.");
  const raw = body as Record<string, unknown>;
  const revision = raw.expectedRevision;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision > 2147483646) {
    throw new ValidationError("Phiên bản lịch bận không hợp lệ. Tải lại rồi thử lại.");
  }
  const busy = raw.busyWeekdays;
  if (!Array.isArray(busy) || busy.length > 7 || busy.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new ValidationError("Ngày bận thường lệ phải là các thứ trong tuần.");
  }
  const overrides = raw.dateOverrides;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new ValidationError("Ngày ngoại lệ không hợp lệ.");
  }
  const entries = Object.entries(overrides as Record<string, unknown>);
  if (entries.length > MAX_OVERRIDES) throw new ValidationError(`Tối đa ${MAX_OVERRIDES} ngày ngoại lệ.`);
  for (const [date, state] of entries) {
    if (!isDate(date) || date < period.startDate || date > period.endDate || (state !== "busy" && state !== "available")) {
      throw new ValidationError("Ngày ngoại lệ phải nằm trong kỳ và là Bận hoặc Rảnh.");
    }
  }
  return {
    expectedRevision: revision,
    busyWeekdays: [...new Set(busy as number[])].sort((a, b) => a - b),
    dateOverrides: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>,
  };
}

const notOpen = () => new ActionError("Chưa có kỳ đang mở để khai lịch bận.", 409, "NO_OPEN_PERIOD");

export async function loadAvailability(user: AuthUser, member: Member, store: AvailabilityStore): Promise<Availability> {
  const period = await store.findOpenPeriod(member.groupId);
  const base = {
    period,
    playingWeekdays: PLAYING_WEEKDAYS,
    busyWeekdays: [] as IsoWeekday[],
    dateOverrides: {} as Record<string, DayOverride>,
    revision: 0,
  };
  if (!period) return { ...base, eligible: false, editable: false, reason: "Chưa có kỳ đang mở.", playDates: [] };

  // Bản cũ không xếp tài khoản quản trị vào lịch chơi; RPC cũng từ chối họ.
  if (user.role !== "user") {
    return { ...base, eligible: false, editable: false, reason: "Tài khoản quản trị không khai lịch bận.", playDates: [] };
  }
  const [fixed, preferences, openDates] = await Promise.all([
    store.isFixedMember(period.id, member.personId),
    store.getPreferences(period.id, member.personId),
    store.listOpenDayDates(period.id),
  ]);
  if (!fixed) {
    return {
      ...base,
      eligible: false,
      editable: false,
      reason: `Chỉ thành viên cố định của ${period.name} mới khai lịch bận.`,
      playDates: [],
    };
  }
  return {
    ...base,
    eligible: true,
    editable: period.status === "open" || period.status === "draft",
    reason: null,
    playDates: playDates(period, openDates),
    busyWeekdays: (preferences?.busyWeekdays ?? []).filter((day): day is IsoWeekday => day >= 1 && day <= 7),
    dateOverrides: Object.fromEntries(
      Object.entries(preferences?.dateOverrides ?? {}).filter(([, state]) => state === "busy" || state === "available"),
    ) as Record<string, DayOverride>,
    revision: preferences?.revision ?? 0,
  };
}

export async function saveAvailability(
  user: AuthUser,
  member: Member,
  body: unknown,
  store: AvailabilityStore,
): Promise<Availability> {
  const period = await store.findOpenPeriod(member.groupId);
  if (!period) throw notOpen();
  const input = parseAvailability(body, period);
  await store.savePreferences(period.id, member.personId, user.id, input);
  return loadAvailability(user, member, store);
}
