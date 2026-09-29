import { supabase } from "../../config/supabase.js";

export const openDaysRepository = {
  list(periodId) {
    return supabase.from("open_play_days")
      .select("play_date, status, capacity, note, registrations:open_play_registrations(person_id, person:people(full_name))")
      .eq("period_id", periodId).order("play_date").limit(500);
  },
  self(email) {
    return supabase.from("people").select("id, status").eq("email", email).maybeSingle();
  },
  mutate(periodId, date, actorId, action, note) {
    return supabase.rpc("mutate_open_play_day", {
      p_period_id: periodId, p_play_date: date, p_actor_id: actorId,
      p_action: action, p_note: note,
    });
  },
};
