import { supabase } from "../config/supabase.js";
import { assertPeopleActive } from "../utils/peopleGuard.js";
import { createActivityStatusGuard } from "./activityStatus.js";

async function rows(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export const activityStatusGuard = createActivityStatusGuard({
  async getRecord(table, id) {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getPeriodPeople(periodId) {
    const [members, buyers] = await Promise.all([
      rows(supabase.from("period_members").select("person_id").eq("period_id", periodId).eq("status", "fixed")),
      rows(supabase.from("shuttle_expenses").select("buyer_id").eq("period_id", periodId).gt("total_amount", 0))
    ]);
    return [...members.map((row) => row.person_id), ...buyers.map((row) => row.buyer_id)];
  },
  async getTournamentPeople(tournamentId) {
    return (await rows(supabase.from("tournament_team_members").select("person_id")
      .eq("tournament_id", tournamentId))).map((row) => row.person_id);
  },
  assertActive: assertPeopleActive
});
