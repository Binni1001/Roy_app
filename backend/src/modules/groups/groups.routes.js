import express from 'express'
import { requireAuth, requireAdmin, requireOwner } from '../../middleware/auth.js'
import { groupsController } from './groups.controller.js'

const router = express.Router()

// Public — kiểm tra mã
router.post('/verify-code', groupsController.verifyCode)

// Auth — mọi user đã đăng nhập
router.get('/mine',                              requireAuth, groupsController.mine)
router.post('/create',                           requireAuth, groupsController.create)
router.post('/join',                             requireAuth, groupsController.join)
router.put('/switch/:groupId',                   requireAuth, groupsController.switchGroup)
router.delete('/:groupId/leave',                 requireAuth, groupsController.leaveGroup)

// Admin — xem info nhóm + tạo mã mới
router.get('/info',                              requireAuth, requireAdmin, groupsController.getInfo)
router.put('/regenerate-code',                   requireAuth, requireAdmin, groupsController.regenerateCode)

// Owner — duyệt thành viên
router.get('/pending',                           requireAuth, requireOwner, groupsController.getPending)
router.put('/members/:personId/approve',         requireAuth, requireOwner, groupsController.approve)
router.put('/members/:personId/reject',          requireAuth, requireOwner, groupsController.reject)

export default router
