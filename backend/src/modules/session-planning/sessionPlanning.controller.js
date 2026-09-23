import { sessionPlanningService } from "./sessionPlanning.service.js";

function failed(res, error) {
  res.status(error.statusCode || 503).json({ code: error.code || "PLANNING_UNAVAILABLE",
    message: error.statusCode ? error.message : "Không thể kiểm tra dữ liệu xếp lịch. Vui lòng thử lại." });
}

export const sessionPlanningController = {
  async get(req, res) {
    try { res.json(await sessionPlanningService.get(req.params.periodId, req.authUser, req.query.week_start)); }
    catch (error) { failed(res, error); }
  },
  async save(req, res) {
    try { res.json(await sessionPlanningService.save(req.params.periodId, req.params.personId, req.body, req.authUser)); }
    catch (error) { failed(res, error); }
  }
};
