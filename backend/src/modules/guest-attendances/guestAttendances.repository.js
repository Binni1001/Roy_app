import { supabase } from "../../config/supabase.js";

export const guestAttendancesRepository = {
  async getAll() {
    return await supabase
      .from("guest_attendances")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        session:badminton_sessions(
          id,
          period_id,
          play_date,
          shuttle_used_count,
          period:periods(id, name, guest_fee_per_session)
        )
      `)
      .order("created_at", { ascending: false });
  },

  async getBySessionId(sessionId) {
    return await supabase
      .from("guest_attendances")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        session:badminton_sessions(
          id,
          period_id,
          play_date,
          shuttle_used_count,
          period:periods(id, name, guest_fee_per_session)
        )
      `)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
  },

  async getByPersonId(personId) {
    return await supabase
      .from("guest_attendances")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        session:badminton_sessions(
          id,
          period_id,
          play_date,
          shuttle_used_count,
          period:periods(id, name, guest_fee_per_session)
        )
      `)
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
  },

  async getById(id) {
    return await supabase
      .from("guest_attendances")
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        session:badminton_sessions(
          id,
          period_id,
          play_date,
          shuttle_used_count,
          period:periods(id, name, guest_fee_per_session)
        )
      `)
      .eq("id", id)
      .single();
  },

  async getSession(sessionId) {
    return await supabase
      .from("badminton_sessions")
      .select(`
        *,
        period:periods(id, name, guest_fee_per_session)
      `)
      .eq("id", sessionId)
      .single();
  },

  async findBySessionAndPerson(sessionId, personId) {
    return await supabase
      .from("guest_attendances")
      .select("*")
      .eq("session_id", sessionId)
      .eq("person_id", personId)
      .maybeSingle();
  },

  async create(payload) {
    return await supabase
      .from("guest_attendances")
      .insert([payload])
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        session:badminton_sessions(
          id,
          period_id,
          play_date,
          shuttle_used_count,
          period:periods(id, name, guest_fee_per_session)
        )
      `)
      .single();
  },

  async update(id, payload) {
    return await supabase
      .from("guest_attendances")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        person:people(id, full_name, nickname, phone),
        session:badminton_sessions(
          id,
          period_id,
          play_date,
          shuttle_used_count,
          period:periods(id, name, guest_fee_per_session)
        )
      `)
      .single();
  },

  async remove(id) {
    return await supabase
      .from("guest_attendances")
      .delete()
      .eq("id", id)
      .select()
      .single();
  },

  async createDebt(payload) {
    return await supabase
      .from("debts")
      .insert([payload])
      .select()
      .single();
  },

  async findGuestDebt(periodId, personId, attendanceId) {
    return await supabase
      .from("debts")
      .select("*")
      .eq("period_id", periodId)
      .eq("person_id", personId)
      .eq("debt_type", "guest_fee")
      .eq("status", "unpaid")
      .ilike("description", `%[guest_attendance:${attendanceId}]%`)
      .order("created_at", { ascending: false })
      .limit(1)
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
  }
};
