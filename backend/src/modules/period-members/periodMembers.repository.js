import { supabase } from "../../config/supabase.js";

export const periodMembersRepository = {
  async getByPeriodId(periodId) {
    return await supabase
      .from("period_members")
      .select(`
        *,
        person:people (
          id,
          full_name,
          nickname,
          phone,
          email,
          avatar_url,
          bio,
          status
        ),
        period:periods (
          id,
          name,
          start_date,
          end_date,
          fixed_member_fee,
          guest_fee_per_session,
          status
        )
      `)
      .eq("period_id", periodId)
      .order("created_at", { ascending: false });
  },

  async getById(id) {
    return await supabase
      .from("period_members")
      .select(`
        *,
        person:people (
          id,
          full_name,
          nickname,
          phone,
          email,
          avatar_url,
          bio,
          status
        ),
        period:periods (
          id,
          name,
          start_date,
          end_date,
          fixed_member_fee,
          guest_fee_per_session,
          status
        )
      `)
      .eq("id", id)
      .single();
  },

  async findByPeriodAndPerson(periodId, personId) {
    return await supabase
      .from("period_members")
      .select("*")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .maybeSingle();
  },

  async create(payload) {
    return await supabase
      .from("period_members")
      .insert([payload])
      .select(`
        *,
        person:people (
          id,
          full_name,
          nickname,
          phone,
          email,
          avatar_url,
          bio,
          status
        )
      `)
      .single();
  },

  async update(id, payload) {
    return await supabase
      .from("period_members")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        person:people (
          id,
          full_name,
          nickname,
          phone,
          email,
          avatar_url,
          bio,
          status
        )
      `)
      .single();
  },

  async remove(id) {
    return await supabase
      .from("period_members")
      .delete()
      .eq("id", id)
      .select()
      .single();
  },

  async getPeriodById(periodId) {
    return await supabase
      .from("periods")
      .select("*")
      .eq("id", periodId)
      .single();
  },

  async getPersonById(personId) {
    return await supabase
      .from("people")
      .select("id, status, attendance_type")
      .eq("id", personId)
      .single();
  },

  async createDebt(payload) {
    return await supabase
      .from("debts")
      .insert([payload])
      .select()
      .single();
  },

  async findMonthlyDebt(periodId, personId) {
    return await supabase
      .from("debts")
      .select("*")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .eq("debt_type", "monthly_fee")
      .neq("status", "cancelled")
      .maybeSingle();
  },

  async cancelDebt(debtId) {
    return await supabase
      .from("debts")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", debtId)
      .select()
      .single();
  },

  async findAnyMonthlyDebt(periodId, personId) {
    return await supabase
      .from("debts")
      .select("*")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .eq("debt_type", "monthly_fee")
      .maybeSingle();
  }
};