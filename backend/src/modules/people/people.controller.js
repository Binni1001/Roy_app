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

  async create(req, res) {
    try {
      const data = await peopleService.createPerson(req.body);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};