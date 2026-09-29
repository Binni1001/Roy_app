import { openDaysRepository } from "./openDays.repository.js";
import { periodsService } from "../periods/periods.service.js";
import { canManageGroup, isGroupId } from "../../utils/groupAuthorization.js";
import { getUserRole } from "../../utils/roles.js";
import { isDate, planningError } from "./sessionPlanning.rules.js";

export function openDayResult(result) {
  if (!result.error) return result.data;
  const { code, message } = result.error;
  if (["42P01", "PGRST205", "PGRST202", "42883"].includes(code)) throw planningError("Buổi tự đăng ký chưa được kích hoạt. Vui lòng liên hệ quản trị viên.", 503, "OPEN_DAYS_SCHEMA_NOT_READY");
  if (message === "OPEN_DAY_FULL") throw planningError("Buổi này vừa đủ người. Hãy chọn ngày khác hoặc làm mới.", 409, "OPEN_DAY_FULL");
  if (code === "42501") throw planningError("Bạn không còn quyền thao tác trong CLB này.", 403, "OPEN_DAY_FORBIDDEN");
  if (code === "22023") throw planningError("Ngày không hợp lệ, kỳ chưa mở hoặc đã qua giờ đăng ký/hủy.", 409, "OPEN_DAY_UNAVAILABLE");
  throw planningError("Không thể tải hoặc lưu đăng ký. Vui lòng thử lại.", 503, "OPEN_DAY_UNAVAILABLE");
}

export function createOpenDaysService({ repo = openDaysRepository, getPeriod = (...args) => periodsService.getAccessiblePeriod(...args), now = () => Date.now() } = {}) {
  async function context(periodId, user) {
    if (!isGroupId(periodId) || !isGroupId(user?.id)) throw planningError("Mã kỳ hoặc tài khoản không hợp lệ.");
    const period = await getPeriod(periodId, user);
    return { period, manager: canManageGroup(user, period.group_id) };
  }
  return {
    async list(periodId, user) {
      const { period, manager } = await context(periodId, user);
      const rows = openDayResult(await repo.list(periodId));
      if (rows.length >= 500) throw planningError("Danh sách quá lớn. Vui lòng liên hệ quản trị viên.", 503);
      const self = getUserRole(user) === "user" ? openDayResult(await repo.self(user.email?.trim().toLowerCase() || "")) : null;
      return {
        can_manage: manager, can_edit: period.status === "open",
        period: { start_date: period.start_date, end_date: period.end_date },
        days: rows.map(({ registrations, ...day }) => {
          const started = now() >= Date.parse(`${day.play_date}T17:30:00+07:00`);
          const joined = registrations.some(row => row.person_id === self?.id);
          return { ...day, count: registrations.length, joined,
            can_join: !manager && self?.status === "active" && period.status === "open" && !started && day.status === "open" && !joined && registrations.length < day.capacity,
            can_leave: joined && period.status === "open" && !started,
            can_change: manager && period.status === "open" && !started,
            started, names: manager ? registrations.map(row => row.person?.full_name || "Thành viên") : undefined };
        }),
      };
    },
    async mutate(periodId, date, payload, user) {
      const { period, manager } = await context(periodId, user);
      const action = payload?.action;
      if (!["open", "close", "reopen", "join", "leave"].includes(action)) throw planningError("Thao tác không hợp lệ.");
      if (["open", "close", "reopen"].includes(action) ? !manager : getUserRole(user) !== "user") throw planningError("Bạn không được thực hiện thao tác này.", 403);
      if (!isDate(date) || date < period.start_date || date > period.end_date || period.status !== "open" || now() >= Date.parse(`${date}T17:30:00+07:00`)) throw planningError("Chọn ngày trong kỳ đang mở, trước giờ chơi 17:30.", 409);
      const note = payload.note ?? "";
      if (typeof note !== "string" || note.trim().length > 300) throw planningError("Ghi chú tối đa 300 ký tự.");
      openDayResult(await repo.mutate(periodId, date, user.id, action, note.trim()));
      return { success: true };
    },
  };
}
export const openDaysService = createOpenDaysService();
