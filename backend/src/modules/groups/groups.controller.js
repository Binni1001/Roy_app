import { groupsService } from './groups.service.js'
import { peopleService } from '../people/people.service.js'

async function getActivePerson(req) {
  return peopleService.getPersonByAuthUser(req.authUser)
}

export const groupsController = {
  // POST /api/groups/verify-code — public
  async verifyCode(req, res) {
    try {
      const result = await groupsService.verifyCode(req.body.invite_code)
      res.json(result)
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // GET /api/groups/mine — danh sách nhóm của tôi
  async mine(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person) return res.status(404).json({ message: 'Chưa có hồ sơ.' })
      const groups = await groupsService.getMyGroups(person.id)
      res.json(groups)
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },

  // POST /api/groups/create — tạo nhóm mới
  // Body: { name } hoặc { name, full_name } nếu chưa có hồ sơ
  async create(req, res) {
    try {
      const { name, full_name } = req.body
      if (!name?.trim()) return res.status(400).json({ message: 'Tên nhóm không được để trống.' })

      let person = await getActivePerson(req)

      if (!person) {
        if (!full_name?.trim()) return res.status(400).json({ message: 'Vui lòng nhập tên của bạn.' })
        const email = req.authUser.email
        if (!email) return res.status(400).json({ message: 'Tài khoản chưa có email.' })
        const result = await groupsService.createGroupAndPerson(email, full_name.trim(), name, peopleService)
        return res.json({ message: `Đã tạo nhóm "${result.group.name}".`, group: result.group, person: result.person })
      }

      const group = await groupsService.createGroup(person.id, name)
      res.json({ message: `Đã tạo nhóm "${group.name}".`, group })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // POST /api/groups/join — tham gia nhóm bằng mã
  // Body: { invite_code, full_name? } — full_name chỉ khi chưa có hồ sơ
  async join(req, res) {
    try {
      const { invite_code, full_name } = req.body

      let person = await getActivePerson(req)

      if (!person) {
        if (!full_name?.trim()) return res.status(400).json({ message: 'Vui lòng nhập tên của bạn.' })
        const email = req.authUser.email
        if (!email) return res.status(400).json({ message: 'Tài khoản chưa có email.' })
        const result = await groupsService.joinGroupAndCreate(null, email, invite_code, full_name.trim(), peopleService)
        return res.json({ message: `Đã gửi yêu cầu tham gia nhóm "${result.group_name}". Chờ trưởng nhóm duyệt.`, person: result.person })
      }

      const result = await groupsService.joinGroup(person.id, invite_code)
      res.json({ message: result.message })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // PUT /api/groups/switch/:groupId — đổi nhóm đang xem
  async switchGroup(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person) return res.status(404).json({ message: 'Chưa có hồ sơ.' })
      const group = await groupsService.switchGroup(person.id, req.params.groupId)
      res.json({ message: `Đã chuyển sang nhóm "${group.name}".`, group })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // DELETE /api/groups/:groupId/leave — rời nhóm
  async leaveGroup(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person) return res.status(404).json({ message: 'Chưa có hồ sơ.' })
      await groupsService.leaveGroup(person.id, req.params.groupId)
      res.json({ message: 'Đã rời nhóm.' })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // GET /api/groups/info — thông tin nhóm đang active
  async getInfo(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person?.active_group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })
      const data = await groupsService.getGroupInfo(person.active_group_id)
      res.json(data)
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },

  // GET /api/groups/pending — owner xem danh sách chờ duyệt
  async getPending(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person?.active_group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })
      const data = await groupsService.getPendingMembers(person.active_group_id)
      res.json(data)
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },

  // PUT /api/groups/members/:personId/approve
  async approve(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person?.active_group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })
      const data = await groupsService.approveMember(req.params.personId, person.active_group_id)
      res.json({ message: 'Đã duyệt thành viên.', membership: data })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // PUT /api/groups/members/:personId/reject
  async reject(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person?.active_group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })
      const data = await groupsService.rejectMember(req.params.personId, person.active_group_id)
      res.json({ message: 'Đã từ chối thành viên.', membership: data })
    } catch (err) {
      res.status(err.statusCode || 400).json({ message: err.message })
    }
  },

  // PUT /api/groups/regenerate-code
  async regenerateCode(req, res) {
    try {
      const person = await getActivePerson(req)
      if (!person?.active_group_id) return res.status(404).json({ message: 'Bạn chưa thuộc nhóm nào.' })
      const data = await groupsService.regenerateCode(person.active_group_id)
      res.json({ message: 'Đã tạo mã mới.', invite_code: data.invite_code })
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message })
    }
  },
}
