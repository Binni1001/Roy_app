import { shuttleExpensesService } from "./shuttleExpenses.service.js";

export const shuttleExpensesController = {
  async getAll(req, res) {
    try {
      const data = await shuttleExpensesService.getAll();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getByPeriod(req, res) {
    try {
      const data = await shuttleExpensesService.getByPeriod(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await shuttleExpensesService.create(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await shuttleExpensesService.update(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      const data = await shuttleExpensesService.remove(req.params.id);
      res.json({
        message: "Xóa khoản mua cầu thành công",
        data
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};