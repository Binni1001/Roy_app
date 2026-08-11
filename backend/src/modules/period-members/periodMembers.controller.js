import { periodMembersService } from "./periodMembers.service.js";

export const periodMembersController = {
  async getByPeriod(req, res) {
    try {
      const data = await periodMembersService.getMembersByPeriod(req.params.periodId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await periodMembersService.getPeriodMemberById(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await periodMembersService.createPeriodMember(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async createBulk(req, res) {
    try {
      const data = await periodMembersService.createPeriodMembers(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await periodMembersService.updatePeriodMember(
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
      const data = await periodMembersService.deletePeriodMember(req.params.id);
      res.json({
        message: "Xoa member khoi ky thanh cong",
        data
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};
