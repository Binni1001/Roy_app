import { supabase } from '../../config/supabase.js'

export const notificationsRepository = {
  async getByPerson(personId) {
    return supabase
      .from('notifications')
      .select('*')
      .eq('person_id', personId)
      .order('created_at', { ascending: false })
      .limit(100)
  },

  async create(payload) {
    return supabase
      .from('notifications')
      .insert([payload])
      .select('*')
      .single()
  },

  async markRead(id, personId) {
    return supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('person_id', personId)
      .select('*')
      .single()
  },

  async markAllRead(personId) {
    return supabase
      .from('notifications')
      .update({ read: true })
      .eq('person_id', personId)
      .eq('read', false)
  },

  async remove(id, personId) {
    return supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('person_id', personId)
  },

  async removeAll(personId) {
    return supabase
      .from('notifications')
      .delete()
      .eq('person_id', personId)
  },
}
