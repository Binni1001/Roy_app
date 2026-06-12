import { debtsService } from "./debts.service.js";

export const debtsController = {
  async getAll(req, res) {
    try {
      const data = await debtsService.getAllDebts();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getByPeriod(req, res) {
    try {
      const data = await debtsService.getDebtsByPeriod(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getByPerson(req, res) {
    try {
      const data = await debtsService.getDebtsByPerson(req.params.personId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await debtsService.createDebt(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async updateStatus(req, res) {
    try {
      const data = await debtsService.updateDebtStatus(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};