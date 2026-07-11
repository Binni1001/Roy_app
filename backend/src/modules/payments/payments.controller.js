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

  async createForPerson(req, res) {
    try {
      const data = await paymentsService.createForPerson(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async payosWebhook(req, res) {
    try {
      const body = req.body || {};

      if (!body.data || !body.signature) {
        return res.status(200).json({
          success: true,
          message: "PayOS webhook test received"
        });
      }

      const data = await paymentsService.handlePayosWebhook(body);

      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async cancelPayment(req, res) {
    try {
      const data = await paymentsService.cancelPayment(req.params.id);

      res.json(data);
    } catch (error) {
      res.status(400).json({
        message: error.message
      });
    }
  }
};
