import { shuttleSettlementsService } from "./shuttleSettlements.service.js";

export const shuttleSettlementsController = {
  async preview(req, res) {
    try {
      const data = await shuttleSettlementsService.preview(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async settle(req, res) {
    try {
      const data = await shuttleSettlementsService.settle(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};