import { badmintonSessionsService } from "./badmintonSessions.service.js";

export const badmintonSessionsController = {
  async getAll(req, res) {
    try {
      const data = await badmintonSessionsService.getAll();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getByPeriod(req, res) {
    try {
      const data = await badmintonSessionsService.getByPeriod(
        req.params.periodId
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await badmintonSessionsService.getById(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await badmintonSessionsService.create(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await badmintonSessionsService.update(
        req.params.id,
        req.body
      );
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      const data = await badmintonSessionsService.remove(req.params.id);
      res.json({
        message: "Xoa buoi danh thanh cong",
        data
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};
