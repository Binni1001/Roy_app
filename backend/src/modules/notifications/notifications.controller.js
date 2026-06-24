import { notificationsService } from './notifications.service.js'

export const notificationsController = {
  async getAll(req, res) {
    try {
      const data = await notificationsService.getAll(req.authUser)
      res.json(data)
    } catch (err) { res.status(500).json({ message: err.message }) }
  },

  async create(req, res) {
    try {
      const data = await notificationsService.create(req.authUser, req.body)
      res.status(201).json(data)
    } catch (err) { res.status(400).json({ message: err.message }) }
  },

  async markRead(req, res) {
    try {
      const data = await notificationsService.markRead(req.authUser, req.params.id)
      res.json(data)
    } catch (err) { res.status(400).json({ message: err.message }) }
  },

  async markAllRead(req, res) {
    try {
      const data = await notificationsService.markAllRead(req.authUser)
      res.json(data)
    } catch (err) { res.status(400).json({ message: err.message }) }
  },

  async remove(req, res) {
    try {
      const data = await notificationsService.remove(req.authUser, req.params.id)
      res.json(data)
    } catch (err) { res.status(400).json({ message: err.message }) }
  },

  async removeAll(req, res) {
    try {
      const data = await notificationsService.removeAll(req.authUser)
      res.json(data)
    } catch (err) { res.status(400).json({ message: err.message }) }
  },

  async remindDebt(req, res) {
    try {
      const data = await notificationsService.remindDebt(req.params.personId)
      res.status(201).json(data)
    } catch (err) { res.status(400).json({ message: err.message }) }
  },
}
