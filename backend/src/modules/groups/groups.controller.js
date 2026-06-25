import { groupsService } from './groups.service.js'
import { peopleService } from '../people/people.service.js'

function getGroupId(req) {
  // Lấy group_id từ person của user đang đăng nhập
  return req.person?.group_id
}

export const groupsController = {
  // POST /api/groups/verify-code — kiểm tra mã nhóm (không cần auth)
  async verifyCode(req, res) {
    try {
      const result = await groupsService.verifyCode(req.body.invite_code)
      res.json(result)
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // POST /api/groups/join — người dùng nhập mã để tham gia nhóm
  // Body: { invite_code, full_name? } — full_name chỉ cần khi chưa có hồ sơ
  async join(req, res) {
    try {
      const { invite_code, full_name } = req.body

      // Tìm hoặc tạo person record
      let person = await peopleService.getPersonByAuthUser(req.authUser)

      if (!person) {
        if (!full_name?.trim()) {
          return res.status(400).json({ message: 'Vui lòng nhập tên của bạn.' })
        }
        const email = req.authUser.email
        if (!email) return res.status(400).json({ message: 'Tài khoản chưa có email.' })

        // Tạo hồ sơ mới với status pending
        const { group_id: gid } = await groupsService.verifyCode(invite_code)
        person = await peopleService.createPerson({
          full_name: full_name.trim(),
          email,
          status: 'pending',
          group_id: gid,
        })
        return res.json({ message: 'Đã gửi yêu cầu tham gia nhóm. Chờ trưởng nhóm duyệt.', person })
      }

      if (person.group_id) return res.status(400).json({ message: 'Bạn đã thuộc một nhóm rồi.' })

      const data = await groupsService.joinGroup(person.id, invite_code)
      res.json({ message: 'Đã gửi yêu cầu tham gia nhóm. Chờ trưởng nhóm duyệt.', person: data })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // GET /api/groups/info — lấy thông tin nhóm của user hiện tại (admin/owner)
  async getInfo(req, res) {
    try {
      const person = await peopleService.getPersonByAuthUser(req.authUser)
      if (!person?.group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })

      const data = await groupsService.getGroupInfo(person.group_id)
      res.json(data)
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },

  // GET /api/groups/pending — owner xem danh sách chờ duyệt
  async getPending(req, res) {
    try {
      const person = await peopleService.getPersonByAuthUser(req.authUser)
      if (!person?.group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })

      const data = await groupsService.getPendingMembers(person.group_id)
      res.json(data)
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },

  // PUT /api/groups/members/:personId/approve
  async approve(req, res) {
    try {
      const person = await peopleService.getPersonByAuthUser(req.authUser)
      if (!person?.group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })

      const data = await groupsService.approveMember(req.params.personId, person.group_id)
      res.json({ message: 'Đã duyệt thành viên.', person: data })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // PUT /api/groups/members/:personId/reject
  async reject(req, res) {
    try {
      const person = await peopleService.getPersonByAuthUser(req.authUser)
      if (!person?.group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })

      const data = await groupsService.rejectMember(req.params.personId, person.group_id)
      res.json({ message: 'Đã từ chối thành viên.', person: data })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // PUT /api/groups/regenerate-code — admin tạo mã mới
  async regenerateCode(req, res) {
    try {
      const person = await peopleService.getPersonByAuthUser(req.authUser)
      if (!person?.group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })

      const data = await groupsService.regenerateCode(person.group_id)
      res.json({ message: 'Đã tạo mã mới.', invite_code: data.invite_code })
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },
}
