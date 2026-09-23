import { sessionPlanningRepository as repository } from "./sessionPlanning.repository.js";
import { periodsService } from "../periods/periods.service.js";
import { annotateActivityPeople } from "../../utils/activityEligibilityDb.js";
import { getUserRole } from "../../utils/roles.js";
import { isGroupId } from "../../utils/groupAuthorization.js";
import { SCHEDULE_RULES, analyzeWeek, defaultWeek, planningError, validatePreferences } from "./sessionPlanning.rules.js";

export function checkPlanningResult(result) {
  if (!result.error) return result.data;
  const { code } = result.error;
  if (["42P01", "PGRST205", "PGRST202", "42883"].includes(code)) {
    throw planningError("Chức năng lịch bận chưa được cài đặt đầy đủ. Admin cần chạy migration lịch buổi cầu.", 503, "PLANNING_SCHEMA_NOT_READY");
  }
  if (code === "40001") throw planningError("Lịch bận đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.", 409, "PLANNING_REVISION_CONFLICT");
  if (code === "42501") throw planningError("Bạn không còn quyền sửa lịch bận này hoặc người chơi không còn đủ điều kiện.", 403, "PLANNING_FORBIDDEN");
  if (code === "22023" || code === "23514") throw planningError("Lịch bận không hợp lệ hoặc kỳ đã đóng.");
  // Never return SQL, Auth metadata or internal database details to the client.
  throw planningError("Không thể tải hoặc lưu dữ liệu xếp lịch. Vui lòng thử lại.", 503, "PLANNING_UNAVAILABLE");
}

export function createSessionPlanningService({ repo = repository, getPeriod = (...args) => periodsService.getAccessiblePeriod(...args), annotate = annotateActivityPeople } = {}) {
  async function context(periodId, user) {
    if (!isGroupId(periodId)) throw planningError("Mã kỳ không hợp lệ.");
    const period = await getPeriod(periodId, user);
    if (!isGroupId(period.group_id)) throw planningError("Kỳ chưa được gắn vào CLB hợp lệ.", 409);
    const [rows, memberships] = await Promise.all([
      repo.members(periodId).then(checkPlanningResult), repo.memberships(period.group_id).then(checkPlanningResult)
    ]);
    // Fail closed rather than misreporting capacity for unexpectedly large/truncated datasets.
    if (rows.length >= 500 || memberships.length >= 500) throw planningError("Danh sách quá lớn để kiểm tra an toàn. Cần phân trang trước khi xếp lịch.", 503);
    const activeIds = new Set(memberships.map((row) => row.person_id));
    const candidates = [...new Map(rows.filter((row) => row.person?.status === "active" && activeIds.has(row.person_id))
      .map((row) => [row.person_id, row.person])).values()];
    const members = (await annotate(candidates)).filter((person) => person.activity_eligible);
    const manager = ["owner", "admin"].includes(getUserRole(user));
    const self = members.find((person) => person.email && person.email.trim().toLowerCase() === user?.email?.trim().toLowerCase());
    if (!manager && !self) throw planningError("Chỉ thành viên cố định đang hoạt động trong kỳ được khai báo lịch bận.", 403, "PLANNING_FORBIDDEN");
    return { period, members, manager, self };
  }
  return {
    async get(periodId, user, weekStart) {
      const { period, members, manager, self } = await context(periodId, user);
      const preferences = checkPlanningResult(await repo.preferences(periodId));
      const week = weekStart === undefined ? defaultWeek(period) : weekStart;
      const analysis = analyzeWeek(period, members, preferences, week);
      const visible = manager ? members : [self];
      const byPerson = new Map(preferences.map((row) => [row.person_id, row]));
      return {
        stage: "availability_only", rules: SCHEDULE_RULES, can_manage: manager,
        can_edit: ["draft", "open"].includes(period.status),
        period: { id: period.id, name: period.name, start_date: period.start_date, end_date: period.end_date, status: period.status },
        members: visible.map((person) => ({ id: person.id, full_name: person.full_name,
          preferences: byPerson.get(person.id) || { person_id: person.id, busy_weekdays: [], date_overrides: {}, revision: 0, updated_at: null } })),
        // Ordinary members see their own availability, never other people's calendars.
        analysis: manager ? analysis : { week_start: analysis.week_start, week_end: analysis.week_end,
          dates: analysis.dates, partial_week: analysis.partial_week,
          availability: analysis.availability.filter((row) => row.person_id === self.id) }
      };
    },
    async save(periodId, personId, payload, user) {
      if (!isGroupId(personId)) throw planningError("Mã người chơi không hợp lệ.");
      const { period, members, manager, self } = await context(periodId, user);
      if (!manager && self.id !== personId) throw planningError("Bạn chỉ được sửa lịch bận của chính mình.", 403, "PLANNING_FORBIDDEN");
      if (!["draft", "open"].includes(period.status)) throw planningError("Kỳ đã đóng, không thể sửa lịch bận.", 409, "PLANNING_PERIOD_CLOSED");
      if (!members.some((person) => person.id === personId)) throw planningError("Người chơi không còn là thành viên cố định hợp lệ trong kỳ.", 403, "PLANNING_FORBIDDEN");
      const validated = validatePreferences(payload, period);
      if (!isGroupId(user?.id)) throw planningError("Tài khoản xác thực không hợp lệ.", 403, "PLANNING_FORBIDDEN");
      const saved = checkPlanningResult(await repo.save(periodId, personId, user.id, validated));
      return { person_id: saved.person_id, busy_weekdays: saved.busy_weekdays, date_overrides: saved.date_overrides,
        revision: saved.revision, updated_at: saved.updated_at };
    }
  };
}

export const sessionPlanningService = createSessionPlanningService();
