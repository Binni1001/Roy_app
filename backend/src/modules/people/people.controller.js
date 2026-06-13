import { peopleService } from "./people.service.js";

export const peopleController = {
  async getAll(req, res) {
    try {
      const data = await peopleService.getAllPeople();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await peopleService.getPersonById(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: error.message });
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
      const data = await peopleService.createPerson(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const data = await peopleService.updatePerson(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      const data = await peopleService.deletePerson(req.params.id);
      res.json({
        message: "Xoa nguoi choi thanh cong",
        data
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};
