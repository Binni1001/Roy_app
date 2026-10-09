import { supabase } from "../../config/supabase.js";

export const shuttleLoansRepository = {
  candidates: (groupId) => supabase.from("person_groups")
    .select("person:people!inner(id,full_name,status)")
    .eq("group_id", groupId).eq("status", "active").eq("person.status", "active"),
  byPeriod: (periodId) => supabase.from("shuttle_loans")
    .select("*, person:people(id,full_name), period:periods(id,name,group_id)")
    .eq("period_id", periodId).order("created_at", { ascending: false }),
  byPerson: (personId) => supabase.from("shuttle_loans")
    .select("*, period:periods!inner(id,name,group_id)")
    .eq("person_id", personId).order("created_at", { ascending: false }),
  personByEmail: (email) => supabase.from("people").select("id,status")
    .eq("email", email).maybeSingle(),
  byId: (id) => supabase.from("shuttle_loans").select("id,period_id").eq("id", id).maybeSingle(),
  create: (payload) => supabase.rpc("create_shuttle_loan", {
    p_period_id: payload.period_id, p_person_id: payload.person_id,
    p_quantity: payload.quantity, p_unit_price: payload.unit_price,
    p_borrowed_at: payload.borrowed_at, p_note: payload.note || null,
  }),
  repay: (id) => supabase.rpc("repay_shuttle_loan", { p_id: id }),
  cancel: (id) => supabase.rpc("cancel_shuttle_loan", { p_id: id }),
};
