import { pkMatchesService } from "./pkMatches.service.js";

export const pkMatchesController = {
  async getAll(req, res) {
    try {
      const data = await pkMatchesService.getAll();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getMyMatches(req, res) {
    try {
      const data = await pkMatchesService.getMyMatches(req.authUser)
      res.json(data)
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async getByPerson(req, res) {
    try {
      const data = await pkMatchesService.getByPerson(req.params.personId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const data = await pkMatchesService.getById(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  },

  async create(req, res) {
    try {
      const isAdmin = req.authRole === 'admin' || req.authRole === 'owner';
      const data = await pkMatchesService.create(req.body, isAdmin);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async createBulk(req, res) {
    try {
      const isAdmin = req.authRole === 'admin' || req.authRole === 'owner';
      const data = await pkMatchesService.createBulk(req.body.matches, isAdmin);
      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async update(req, res) {
    try {
      const isAdmin = req.authRole === 'admin' || req.authRole === 'owner';
      const data = await pkMatchesService.update(req.params.id, req.body, isAdmin, req.authUser);
      res.json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  async remove(req, res) {
    try {
      const data = await pkMatchesService.remove(req.params.id)
      res.json(data)
    } catch (error) {
      res.status(400).json({ message: error.message })
    }
  },

  async getLeaderboard(req, res) {
    try {
      const data = await pkMatchesService.getLeaderboard();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getPublicPeople(req, res) {
    try {
      const data = await pkMatchesService.getPublicPeople();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
