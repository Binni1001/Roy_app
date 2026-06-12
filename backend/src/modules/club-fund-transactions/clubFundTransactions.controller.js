import { clubFundTransactionsService } from "./clubFundTransactions.service.js";

export const clubFundTransactionsController = {
  async getAll(req, res) {
    try {
      const data = await clubFundTransactionsService.getAll();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getByPeriod(req, res) {
    try {
      const data = await clubFundTransactionsService.getByPeriod(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await clubFundTransactionsService.create(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};