import { supabase } from "../../config/supabase.js";

export const sessionPlanningRepository = {
  members(periodId) {
    return supabase.from("period_members")
      .select("person_id, person:people!inner(id, full_name, email, status)")
      .eq("period_id", periodId).eq("status", "fixed").order("person_id");
  },
  memberships(groupId) {
    return supabase.from("person_groups").select("person_id")
      .eq("group_id", groupId).eq("status", "active").eq("member_role", "member");
  },
  preferences(periodId) {
    return supabase.from("session_planning_preferences")
      .select("person_id, busy_weekdays, date_overrides, revision, updated_at")
      .eq("period_id", periodId).order("person_id");
  },
  profiles(periodId) {
    return supabase.from("session_planning_profiles")
      .select("person_id, level, preferred_partner_id, revision, updated_at")
      .eq("period_id", periodId).order("person_id");
  },
  saveProfile(periodId, personId, actorId, payload) {
    return supabase.rpc("save_session_planning_profile", {
      p_period_id: periodId, p_person_id: personId, p_actor_id: actorId,
      p_expected_revision: payload.expected_revision, p_level: payload.level,
      p_preferred_partner_id: payload.preferred_partner_id
    }).single();
  },
  save(periodId, personId, actorId, payload) {
    return supabase.rpc("save_session_planning_preferences", {
      p_period_id: periodId, p_person_id: personId, p_actor_id: actorId,
      p_expected_revision: payload.expected_revision,
      p_busy_weekdays: payload.busy_weekdays, p_date_overrides: payload.date_overrides
    }).single();
  }
};
