import { periodsService } from "./periods.service.js";

export const periodsController = {
  async getAll(req, res) {
    try {
      const data = await periodsService.getAllPeriods();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await periodsService.getPeriodById(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await periodsService.createPeriod(req.body, req.authUser, req.authRole);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await periodsService.updatePeriod(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};
