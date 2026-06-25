import { groupsRepository } from './groups.repository.js'

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

  async joinGroup(personId, code) {
    const { group_id } = await this.verifyCode(code)

    const { data, error } = await groupsRepository.assignPersonToGroup(personId, group_id)
    if (error) throw new Error(error.message)

    return data
  },

  async getPendingMembers(groupId) {
    const { data, error } = await groupsRepository.getPendingMembers(groupId)
    if (error) throw new Error(error.message)
    return data || []
  },

  async approveMember(personId, groupId) {
    const { data, error } = await groupsRepository.updatePersonStatus(personId, groupId, 'active')
    if (error) throw new Error(error.message)
    if (!data) throw Object.assign(new Error('Không tìm thấy thành viên trong nhóm này'), { statusCode: 404 })
    return data
  },

  async rejectMember(personId, groupId) {
    const { data, error } = await groupsRepository.updatePersonStatus(personId, groupId, 'inactive')
    if (error) throw new Error(error.message)
    if (!data) throw Object.assign(new Error('Không tìm thấy thành viên trong nhóm này'), { statusCode: 404 })
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
    if (!data) throw Object.assign(new Error('Không tìm thấy nhóm'), { statusCode: 404 })
    return data
  },
}
