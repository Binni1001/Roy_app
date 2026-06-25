import { supabase } from '../../config/supabase.js'

export const groupsRepository = {
  // ── Groups ──────────────────────────────────────────────
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

  async createGroup(name, inviteCode) {
    return supabase
      .from('groups')
      .insert([{ name, invite_code: inviteCode }])
      .select()
      .single()
  },

  async updateInviteCode(id, newCode) {
    return supabase
      .from('groups')
      .update({ invite_code: newCode, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  },

  // ── Person–Group membership ──────────────────────────────
  async getMembership(personId, groupId) {
    return supabase
      .from('person_groups')
      .select('*')
      .eq('person_id', personId)
      .eq('group_id', groupId)
      .maybeSingle()
  },

  async getMyGroups(personId) {
    return supabase
      .from('person_groups')
      .select('*, groups(*)')
      .eq('person_id', personId)
      .order('joined_at', { ascending: true })
  },

  async countMyGroups(personId) {
    return supabase
      .from('person_groups')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
  },

  async addMembership(personId, groupId, status = 'pending', memberRole = 'member') {
    return supabase
      .from('person_groups')
      .insert([{ person_id: personId, group_id: groupId, status, member_role: memberRole }])
      .select()
      .single()
  },

  async updateMembershipStatus(personId, groupId, status) {
    return supabase
      .from('person_groups')
      .update({ status })
      .eq('person_id', personId)
      .eq('group_id', groupId)
      .select()
      .single()
  },

  async deleteMembership(personId, groupId) {
    return supabase
      .from('person_groups')
      .delete()
      .eq('person_id', personId)
      .eq('group_id', groupId)
  },

  async getPendingMembers(groupId) {
    return supabase
      .from('person_groups')
      .select('*, people(id, full_name, nickname, email, avatar_url, attendance_type, created_at)')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: true })
  },

  async updatePersonStatus(personId, status) {
    return supabase
      .from('people')
      .update({ status })
      .eq('id', personId)
      .select('id, status')
      .single()
  },

  // ── Set active group ─────────────────────────────────────
  async setActiveGroup(personId, groupId) {
    return supabase
      .from('people')
      .update({ active_group_id: groupId, group_id: groupId })
      .eq('id', personId)
      .select()
      .single()
  },
}
