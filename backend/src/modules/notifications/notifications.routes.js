import express from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { notificationsController } from './notifications.controller.js'

const router = express.Router()

router.get('/',              requireAuth, notificationsController.getAll)
router.post('/',             requireAuth, notificationsController.create)
router.put('/read-all',      requireAuth, notificationsController.markAllRead)
router.put('/:id/read',      requireAuth, notificationsController.markRead)
router.delete('/all',        requireAuth, notificationsController.removeAll)
router.delete('/:id',        requireAuth, notificationsController.remove)

export default router
