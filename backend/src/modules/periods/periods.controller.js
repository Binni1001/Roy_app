import { periodsService } from "./periods.service.js";

export const periodsController = {
  async getAll(req, res) {
    try {
      const data = await periodsService.getAllPeriods(req.authUser);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await periodsService.getAccessiblePeriod(req.params.id, req.authUser);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await periodsService.createPeriod(req.body, req.authUser, req.authRole);
      res.status(201).json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      await periodsService.getAccessiblePeriod(req.params.id, req.authUser, true);
      const data = await periodsService.updatePeriod(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  }
};
