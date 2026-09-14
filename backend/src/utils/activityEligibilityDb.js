import { supabase } from "../config/supabase.js";
import { createActivityEligibility } from "./activityEligibility.js";

export const annotateActivityPeople = createActivityEligibility(
  (options) => supabase.auth.admin.listUsers(options)
);
