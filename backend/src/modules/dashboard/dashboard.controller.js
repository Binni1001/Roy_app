import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async getPeriodDashboard(req, res) {
    try {
      const data = await dashboardService.getPeriodDashboard(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(400).json({
        message: error.message
      });
    }
  }
};