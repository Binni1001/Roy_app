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
}
