import { periodsService } from "../modules/periods/periods.service.js";
import { badmintonSessionsService } from "../modules/badminton-sessions/badmintonSessions.service.js";
import { periodMembersRepository } from "../modules/period-members/periodMembers.repository.js";
import { guestAttendancesRepository } from "../modules/guest-attendances/guestAttendances.repository.js";
import { supabase } from "../config/supabase.js";
import { groupAccess, groupError } from "../services/groupAccess.js";

// Before idempotency: authorize the stored parent, never a replacement in body.
export async function attendanceGroupScope(req, res, next) {
  const [module, encodedKey, encodedParentId] = req.path.split("/").filter(Boolean);
  if (!["period-members", "guest-attendances"].includes(module?.toLowerCase())) return next();
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  try {
    const key = encodedKey ? decodeURIComponent(encodedKey) : null;
    const parentId = encodedParentId ? decodeURIComponent(encodedParentId) : null;
    let periodId;
    if (module.toLowerCase() === "period-members") {
      if (key?.toLowerCase() === "period") periodId = parentId;
      else if (key && key.toLowerCase() !== "bulk") {
        const result = await periodMembersRepository.getById(key);
        if (result.error || !result.data) throw groupError("Không tìm thấy thành viên trong kỳ.", 404);
        periodId = result.data.period_id;
        if (write && ((req.body?.period_id !== undefined && req.body.period_id !== periodId) ||
          (req.body?.person_id !== undefined && req.body.person_id !== result.data.person_id))) {
          throw groupError("Không được chuyển thành viên sang người hoặc kỳ khác.", 400);
        }
      } else periodId = req.body?.period_id;
    } else {
      let sessionId;
      if (key?.toLowerCase() === "session") sessionId = parentId;
      else if (!write && (key?.toLowerCase() === "person" || !key)) {
        req.visibleGroupIds = await groupAccess.visibleGroupIds(req.authUser);
        return next(); // Self ownership remains enforced by the route guard.
      } else if (key) {
        const result = await guestAttendancesRepository.getById(key);
        if (result.error || !result.data) throw groupError("Không tìm thấy lượt khách.", 404);
        sessionId = result.data.session_id;
        if (write && ((req.body?.session_id !== undefined && req.body.session_id !== sessionId) ||
          (req.body?.person_id !== undefined && req.body.person_id !== result.data.person_id))) {
          throw groupError("Không được chuyển lượt khách sang người hoặc buổi khác.", 400);
        }
      } else sessionId = req.body?.session_id;
      const session = await badmintonSessionsService.getById(sessionId, req.authUser, write);
      periodId = session.period_id;
    }
    const period = await periodsService.getAccessiblePeriod(periodId, req.authUser, write);
    if (write && period.status === "closed") throw groupError("Kỳ đã đóng, không được thay đổi thành viên hoặc khách.", 409);
    if (write && module.toLowerCase() === "guest-attendances" && period.status !== "open") {
      throw groupError("Chỉ được ghi nhận khách trong kỳ đang mở.", 409);
    }
    if (req.method === "POST") {
      const ids = req.body?.person_ids ?? [req.body?.person_id];
      if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id)) {
        throw groupError("Danh sách người tham gia không hợp lệ (1–100 người).", 400);
      }
      const result = await supabase.from("person_groups").select("person_id")
        .eq("group_id", period.group_id).eq("status", "active").in("person_id", ids);
      if (result.error) throw groupError("Không thể kiểm tra thành viên nhóm.", 503);
      const members = new Set((result.data || []).map((row) => row.person_id));
      if (ids.some((id) => !members.has(id))) throw groupError("Người tham gia phải là thành viên đang hoạt động của nhóm thuộc kỳ.");
    }
    next();
  } catch (error) {
    res.status(error.statusCode || 500).json({ code: "ATTENDANCE_SCOPE_DENIED",
      message: error.statusCode ? error.message : "Không thể kiểm tra quyền truy cập kỳ." });
  }
}
