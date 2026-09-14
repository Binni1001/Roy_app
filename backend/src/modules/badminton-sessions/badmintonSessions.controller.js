import { badmintonSessionsService } from "./badmintonSessions.service.js";

export const badmintonSessionsController = {
  async getAll(req, res) {
    try {
      const data = await badmintonSessionsService.getAll(req.authUser);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  },

  async getByPeriod(req, res) {
    try {
      const data = await badmintonSessionsService.getByPeriod(
        req.params.periodId, req.authUser
      );
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await badmintonSessionsService.getById(req.params.id, req.authUser);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await badmintonSessionsService.create(req.body, req.authUser);
      res.status(201).json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await badmintonSessionsService.update(
        req.params.id,
        req.body, req.authUser
      );
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      const data = await badmintonSessionsService.remove(req.params.id, req.authUser);
      res.json({
        message: "Xoa buoi danh thanh cong",
        data
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  }
};
