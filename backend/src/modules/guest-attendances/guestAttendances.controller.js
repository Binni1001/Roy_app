import { guestAttendancesService } from "./guestAttendances.service.js";

export const guestAttendancesController = {
  async getAll(req, res) {
    try {
      const data = await guestAttendancesService.getAll();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getBySession(req, res) {
    try {
      const data = await guestAttendancesService.getBySession(
        req.params.sessionId
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getByPerson(req, res) {
    try {
      const data = await guestAttendancesService.getByPerson(
        req.params.personId
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await guestAttendancesService.getById(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await guestAttendancesService.create(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await guestAttendancesService.update(
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
      const data = await guestAttendancesService.remove(req.params.id);
      res.json({
        message: "Xoa khach vang lai thanh cong",
        data
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};
