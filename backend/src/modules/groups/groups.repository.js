import { supabase } from '../../config/supabase.js'

export const groupsRepository = {
  async getByInviteCode(code) {
    return supabase
      .from('groups')
      .select('*')
      .ilike('invite_code', code)
      .maybeSingle()
  },

  async getById(id) {
    return supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .maybeSingle()
  },

  async updateInviteCode(id, newCode) {
    return supabase
      .from('groups')
      .update({ invite_code: newCode, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  },

  async getPendingMembers(groupId) {
    return supabase
      .from('people')
      .select('id, full_name, nickname, email, avatar_url, attendance_type, created_at')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
  },

  async updatePersonStatus(personId, groupId, status) {
    return supabase
      .from('people')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', personId)
      .eq('group_id', groupId)
      .select()
      .single()
  },

  async assignPersonToGroup(personId, groupId) {
    return supabase
      .from('people')
      .update({ group_id: groupId, status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', personId)
      .select()
      .single()
  },
}
