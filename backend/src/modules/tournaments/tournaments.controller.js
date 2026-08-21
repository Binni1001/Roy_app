import { tournamentsService } from "./tournaments.service.js";

function sendError(res, error, fallbackStatus = 400) {
  res.status(error.statusCode || fallbackStatus).json({ message: error.message });
}

export const tournamentsController = {
  async list(req, res) {
    try {
      res.json(await tournamentsService.list(req.authUser, req.authRole));
    } catch (error) { sendError(res, error, 500); }
  },

  async get(req, res) {
    try {
      res.json(await tournamentsService.get(req.params.id, req.authUser, req.authRole));
    } catch (error) { sendError(res, error, 404); }
  },

  async create(req, res) {
    try {
      res.status(201).json(await tournamentsService.create(req.body, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },

  async update(req, res) {
    try {
      res.json(await tournamentsService.update(req.params.id, req.body, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },

  async configure(req, res) {
    try {
      res.json(await tournamentsService.configure(req.params.id, req.body, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },

  async publish(req, res) {
    try {
      res.json(await tournamentsService.publish(req.params.id, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },

  async buildKnockout(req, res) {
    try {
      res.json(await tournamentsService.buildKnockout(req.params.id, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },

  async saveMatch(req, res) {
    try {
      res.json(await tournamentsService.saveMatch(req.params.id, req.params.matchId, req.body, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },

  async remove(req, res) {
    try {
      res.json(await tournamentsService.remove(req.params.id, req.authUser, req.authRole));
    } catch (error) { sendError(res, error); }
  },
};
