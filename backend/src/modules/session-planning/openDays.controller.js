import { openDaysService } from "./openDays.service.js";

function failed(res, error) {
  res.status(error.statusCode || 503).json({ code: error.code || "OPEN_DAY_UNAVAILABLE", message: error.statusCode ? error.message : "Không thể xử lý đăng ký. Vui lòng thử lại." });
}
export const openDaysController = {
  async list(req, res) {
    try { res.json(await openDaysService.list(req.params.periodId, req.authUser)); }
    catch (error) { failed(res, error); }
  },
  async mutate(req, res) {
    try { res.json(await openDaysService.mutate(req.params.periodId, req.params.date, req.body, req.authUser)); }
    catch (error) { failed(res, error); }
  },
};
