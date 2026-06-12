import { paymentsService } from "./payments.service.js";

export const paymentsController = {
  async createForPersonPeriod(req, res) {
    try {
      const data = await paymentsService.createForPersonPeriod(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({
        message: error.message
      });
    }
  },

  async payosWebhook(req, res) {
    try {
      const data = await paymentsService.handlePayosWebhook(req.body);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
};