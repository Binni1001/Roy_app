import { peopleService } from "./people.service.js";

export const peopleController = {
  async getAll(req, res) {
    try {
      const data = await peopleService.getAllPeople(req.authUser, req.authRole);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await peopleService.getManagedPerson(req.authUser, req.params.id);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 404).json({ message: error.message });
    }
  },

  async getMe(req, res) {
    try {
      const data = await peopleService.getPersonByAuthUser(req.authUser);

      if (!data) {
        res.status(404).json({ message: "Player profile does not exist" });
        return;
      }

      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async createMe(req, res) {
    try {
      const data = await peopleService.createPersonForAuthUser(req.authUser, req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async updateMe(req, res) {
    try {
      const data = await peopleService.updatePersonForAuthUser(req.authUser, req.body);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const data = await peopleService.createManagedPerson(req.authUser, req.authRole, req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await peopleService.updateManagedPerson(req.authUser, req.params.id, req.body);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  },

  async updatePassword(req, res) {
    try {
      const data = await peopleService.updateManagedPassword(req.authUser, req.params.id, req.body.password);
      res.json(data);
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      const data = await peopleService.deleteManagedPerson(req.authUser, req.params.id);
      res.json({
        message: "Xoa nguoi choi thanh cong",
        data
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ message: error.message });
    }
  }
};
