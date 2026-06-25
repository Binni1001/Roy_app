import express from 'express'
import { requireAuth, requireAdmin, requireOwner } from '../../middleware/auth.js'
import { groupsController } from './groups.controller.js'

const router = express.Router()

// Public — kiểm tra mã (không cần đăng nhập để check)
router.post('/verify-code', groupsController.verifyCode)

// Auth — người dùng tham gia nhóm bằng mã
router.post('/join', requireAuth, groupsController.join)

// Admin — xem thông tin nhóm + mã hiện tại
router.get('/info', requireAuth, requireAdmin, groupsController.getInfo)

// Admin — tạo mã mới
router.put('/regenerate-code', requireAuth, requireAdmin, groupsController.regenerateCode)

// Owner — xem danh sách chờ duyệt
router.get('/pending', requireAuth, requireOwner, groupsController.getPending)

// Owner — duyệt / từ chối thành viên
router.put('/members/:personId/approve', requireAuth, requireOwner, groupsController.approve)
router.put('/members/:personId/reject',  requireAuth, requireOwner, groupsController.reject)

export default router
