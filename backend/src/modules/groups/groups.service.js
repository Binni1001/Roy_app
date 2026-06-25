import { groupsRepository } from './groups.repository.js'

const MAX_GROUPS = 3

function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const groupsService = {
  async verifyCode(code) {
    if (!code?.trim()) throw Object.assign(new Error('Mã nhóm không được để trống'), { statusCode: 400 })
    const { data, error } = await groupsRepository.getByInviteCode(code.trim())
    if (error) throw new Error(error.message)
    if (!data) throw Object.assign(new Error('Mã nhóm không đúng. Vui lòng kiểm tra lại.'), { statusCode: 400 })
    return { valid: true, group_id: data.id, group_name: data.name }
  },

  async createGroup(personId, name) {
    if (!name?.trim()) throw Object.assign(new Error('Tên nhóm không được để trống'), { statusCode: 400 })

    // Check số nhóm hiện tại
    const { count, error: countErr } = await groupsRepository.countMyGroups(personId)
    if (countErr) throw new Error(countErr.message)
    if (count >= MAX_GROUPS) {
      throw Object.assign(new Error(`Bạn đã tham gia ${MAX_GROUPS} nhóm. Rời một nhóm trước khi tạo nhóm mới.`), { statusCode: 400 })
    }

    // Tạo nhóm
    const code = generateCode()
    const { data: group, error: groupErr } = await groupsRepository.createGroup(name.trim(), code)
    if (groupErr) throw new Error(groupErr.message)

    // Tự động join với role owner + status active
    const { error: memErr } = await groupsRepository.addMembership(personId, group.id, 'active', 'owner')
    if (memErr) throw new Error(memErr.message)

    // Set làm active group
    await groupsRepository.setActiveGroup(personId, group.id)

    return group
  },

  async joinGroup(personId, code, fullName = null, peopleService = null) {
    const { group_id, group_name } = await this.verifyCode(code)

    // Check số nhóm hiện tại
    const { count, error: countErr } = await groupsRepository.countMyGroups(personId)
    if (countErr) throw new Error(countErr.message)
    if (count >= MAX_GROUPS) {
      throw Object.assign(new Error(`Bạn đã tham gia ${MAX_GROUPS} nhóm. Rời một nhóm trước khi tham gia nhóm mới.`), { statusCode: 400 })
    }

    // Check đã join chưa
    const { data: existing } = await groupsRepository.getMembership(personId, group_id)
    if (existing) throw Object.assign(new Error('Bạn đã tham gia nhóm này rồi.'), { statusCode: 400 })

    // Thêm membership pending
    const { error: memErr } = await groupsRepository.addMembership(personId, group_id, 'pending', 'member')
    if (memErr) throw new Error(memErr.message)

    return { group_name, message: 'Đã gửi yêu cầu. Chờ trưởng nhóm duyệt.' }
  },

  async joinGroupAndCreate(personId, email, code, fullName, peopleService) {
    // Dùng khi chưa có person record: tạo person + join trong 1 luồng
    const { group_id, group_name } = await this.verifyCode(code)

    // Tạo person record
    const person = await peopleService.createPerson({
      full_name: fullName,
      email,
      status: 'active',
      group_id,
      active_group_id: group_id,
    })

    // Thêm membership pending
    await groupsRepository.addMembership(person.id, group_id, 'pending', 'member')

    return { person, group_name }
  },

  async createGroupAndPerson(email, name, groupName, peopleService) {
    // Dùng khi chưa có person record: tạo nhóm mới + person record
    const code = generateCode()
    const { data: group, error: groupErr } = await groupsRepository.createGroup(groupName.trim(), code)
    if (groupErr) throw new Error(groupErr.message)

    const person = await peopleService.createPerson({
      full_name: name,
      email,
      status: 'active',
      group_id: group.id,
      active_group_id: group.id,
    })

    await groupsRepository.addMembership(person.id, group.id, 'active', 'owner')

    return { person, group }
  },

  async getMyGroups(personId) {
    const { data, error } = await groupsRepository.getMyGroups(personId)
    if (error) throw new Error(error.message)
    return (data || []).map(row => ({
      ...row.groups,
      membership_status: row.status,
      member_role: row.member_role,
      joined_at: row.joined_at,
    }))
  },

  async switchGroup(personId, groupId) {
    // Kiểm tra người đó có trong nhóm và đã active chưa
    const { data: mem, error } = await groupsRepository.getMembership(personId, groupId)
    if (error) throw new Error(error.message)
    if (!mem) throw Object.assign(new Error('Bạn không thuộc nhóm này.'), { statusCode: 403 })
    if (mem.status !== 'active') throw Object.assign(new Error('Bạn chưa được duyệt vào nhóm này.'), { statusCode: 403 })

    await groupsRepository.setActiveGroup(personId, groupId)
    const { data: group } = await groupsRepository.getById(groupId)
    return group
  },

  async leaveGroup(personId, groupId) {
    const { data: mem } = await groupsRepository.getMembership(personId, groupId)
    if (!mem) throw Object.assign(new Error('Bạn không thuộc nhóm này.'), { statusCode: 400 })
    if (mem.member_role === 'owner') throw Object.assign(new Error('Trưởng nhóm không thể rời nhóm. Hãy chuyển quyền trước.'), { statusCode: 400 })

    await groupsRepository.deleteMembership(personId, groupId)

    // Nếu đang active vào nhóm này → switch sang nhóm khác
    const { data: others } = await groupsRepository.getMyGroups(personId)
    const activeOther = (others || []).find(r => r.status === 'active' && r.group_id !== groupId)
    if (activeOther) {
      await groupsRepository.setActiveGroup(personId, activeOther.group_id)
    } else {
      await groupsRepository.setActiveGroup(personId, null)
    }
  },

  async getPendingMembers(groupId) {
    const { data, error } = await groupsRepository.getPendingMembers(groupId)
    if (error) throw new Error(error.message)
    return (data || []).map(row => ({ ...row.people, membership_id: row.id }))
  },

  async approveMember(personId, groupId) {
    const { data, error } = await groupsRepository.updateMembershipStatus(personId, groupId, 'active')
    if (error) throw new Error(error.message)
    if (!data) throw Object.assign(new Error('Không tìm thấy thành viên trong nhóm.'), { statusCode: 404 })

    // Set active_group_id nếu chưa có
    await groupsRepository.setActiveGroup(personId, groupId)
    return data
  },

  async rejectMember(personId, groupId) {
    const { data, error } = await groupsRepository.updateMembershipStatus(personId, groupId, 'inactive')
    if (error) throw new Error(error.message)
    if (!data) throw Object.assign(new Error('Không tìm thấy thành viên trong nhóm.'), { statusCode: 404 })
    return data
  },

  async regenerateCode(groupId) {
    const newCode = generateCode()
    const { data, error } = await groupsRepository.updateInviteCode(groupId, newCode)
    if (error) throw new Error(error.message)
    return { invite_code: data.invite_code }
  },

  async getGroupInfo(groupId) {
    const { data, error } = await groupsRepository.getById(groupId)
    if (error) throw new Error(error.message)
    if (!data) throw Object.assign(new Error('Không tìm thấy nhóm.'), { statusCode: 404 })
    return data
  },
}
