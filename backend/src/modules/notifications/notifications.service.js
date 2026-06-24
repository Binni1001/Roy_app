import { notificationsRepository } from './notifications.repository.js'
import { supabase } from '../../config/supabase.js'

async function getPersonId(authUser) {
  const { data } = await supabase
    .from('people')
    .select('id')
    .eq('email', authUser.email)
    .single()
  if (!data) throw new Error('Không tìm thấy hồ sơ người chơi')
  return data.id
}

export const notificationsService = {
  async getAll(authUser) {
    const personId = await getPersonId(authUser)
    const { data, error } = await notificationsRepository.getByPerson(personId)
    if (error) throw new Error(error.message)
    return data
  },

  async create(authUser, payload) {
    const personId = await getPersonId(authUser)
    const { data, error } = await notificationsRepository.create({
      person_id: personId,
      kind:   payload.kind,
      icon:   payload.icon   || null,
      title:  payload.title,
      body:   payload.body   || null,
      action: payload.action || null,
    })
    if (error) throw new Error(error.message)
    return data
  },

  async markRead(authUser, id) {
    const personId = await getPersonId(authUser)
    const { data, error } = await notificationsRepository.markRead(id, personId)
    if (error) throw new Error(error.message)
    return data
  },

  async markAllRead(authUser) {
    const personId = await getPersonId(authUser)
    const { error } = await notificationsRepository.markAllRead(personId)
    if (error) throw new Error(error.message)
    return { ok: true }
  },

  async remove(authUser, id) {
    const personId = await getPersonId(authUser)
    const { error } = await notificationsRepository.remove(id, personId)
    if (error) throw new Error(error.message)
    return { ok: true }
  },

  async removeAll(authUser) {
    const personId = await getPersonId(authUser)
    const { error } = await notificationsRepository.removeAll(personId)
    if (error) throw new Error(error.message)
    return { ok: true }
  },

  async remindDebt(targetPersonId) {
    if (!targetPersonId) throw new Error('Person ID không được để trống')

    const personResult = await notificationsRepository.getPersonById(targetPersonId)
    if (personResult.error) throw new Error(personResult.error.message)
    if (!personResult.data) throw new Error('Không tìm thấy người này')

    const debtsResult = await notificationsRepository.getUnpaidDebtsByPerson(targetPersonId)
    if (debtsResult.error) throw new Error(debtsResult.error.message)

    const debts = debtsResult.data || []
    if (debts.length === 0) throw new Error('Người này không có khoản nợ chưa thanh toán')

    const total = debts.reduce((s, d) => s + Number(d.amount), 0)
    const lines = debts
      .map((d) => `• ${d.description || d.debt_type}: ${Number(d.amount).toLocaleString('vi-VN')}đ`)
      .join('\n')

    const { data, error } = await notificationsRepository.create({
      person_id: targetPersonId,
      kind: 'debt_reminder',
      icon: '⚠️',
      title: 'Nhắc nhở: Bạn còn khoản nợ chưa thanh toán',
      body: `Tổng cộng ${total.toLocaleString('vi-VN')}đ\n${lines}`,
      action: 'home',
    })
    if (error) throw new Error(error.message)
    return data
  },
}
