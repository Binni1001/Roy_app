import { pkMatchesService } from "./pkMatches.service.js";

function sendError(res, error, fallbackStatus = 400) {
  const conflict = /locked|already completed|earlier PK matches|cannot be deleted|kh[o\u00f3]a|ho\u00e0n t\u1ea5t|tr\u1eadn tr\u01b0\u1edbc|kh[o\u00f4]ng th\u1ec3 x[o\u00f3]a/i.test(error.message);
  res.status(conflict ? 409 : fallbackStatus).json({ message: error.message });
}

export const pkMatchesController = {
  async getAll(req, res) {
    try {
      res.json(await pkMatchesService.getAll(req.query.period_id || null));
    } catch (error) {
      sendError(res, error, 500);
    }
  },

  async getMyMatches(req, res) {
    try {
      res.json(await pkMatchesService.getMyMatches(req.authUser, req.query.period_id || null));
    } catch (error) {
      sendError(res, error, 500);
    }
  },

  async getByPerson(req, res) {
    try {
      res.json(await pkMatchesService.getByPerson(req.params.personId, req.query.period_id || null));
    } catch (error) {
      sendError(res, error, 500);
    }
  },

  async getById(req, res) {
    try {
      res.json(await pkMatchesService.getById(req.params.id));
    } catch (error) {
      sendError(res, error, 404);
    }
  },

  async create(req, res) {
    try {
      const isAdmin = req.authRole === "admin" || req.authRole === "owner";
      res.status(201).json(await pkMatchesService.create(req.body, isAdmin));
    } catch (error) {
      sendError(res, error);
    }
  },

  async createBulk(req, res) {
    try {
      const isAdmin = req.authRole === "admin" || req.authRole === "owner";
      const data = await pkMatchesService.createBulk(
        req.body.matches,
        isAdmin,
        req.body.period_id || null
      );
      res.status(201).json(data);
    } catch (error) {
      sendError(res, error);
    }
  },

  async update(req, res) {
    try {
      const isAdmin = req.authRole === "admin" || req.authRole === "owner";
      res.json(await pkMatchesService.update(
        req.params.id,
        req.body,
        isAdmin,
        req.authUser
      ));
    } catch (error) {
      sendError(res, error);
    }
  },

  async finalize(req, res) {
    try {
      const isAdmin = req.authRole === "admin" || req.authRole === "owner";
      res.json(await pkMatchesService.finalize(
        req.params.id,
        req.body,
        isAdmin,
        req.authUser
      ));
    } catch (error) {
      sendError(res, error);
    }
  },

  async remove(req, res) {
    try {
      res.json(await pkMatchesService.remove(req.params.id));
    } catch (error) {
      sendError(res, error);
    }
  },

  async voidResult(req, res) {
    try {
      res.json(await pkMatchesService.voidResult(req.params.id, req.body.reason, req.authUser));
    } catch (error) {
      sendError(res, error);
    }
  },

  async getLeaderboard(req, res) {
    try {
      res.json(await pkMatchesService.getLeaderboard(req.query.period_id, req.query.match_type));
    } catch (error) {
      sendError(res, error);
    }
  },

  async getPublicPeople(req, res) {
    try {
      res.json(await pkMatchesService.getPublicPeople());
    } catch (error) {
      sendError(res, error, 500);
    }
  },
};
