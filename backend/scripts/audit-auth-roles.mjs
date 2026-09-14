// Read-only preflight. Only aggregate counts are printed: no emails, IDs,
// tokens or complete metadata. Never auto-promote user-controlled metadata.
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ quiet: true });
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Role audit requires backend SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exitCode = 1;
} else {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const counts = { total: 0, trustedOwner: 0, trustedAdmin: 0, trustedUser: 0,
    missingAppRole: 0, invalidAppRole: 0, legacyPrivilegedOnly: 0, metadataMismatch: 0 };
  try {
    for (let page = 1; ; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
      if (error || !Array.isArray(data?.users)) throw new Error("Auth audit request failed");
      for (const user of data.users) {
        counts.total += 1;
        const appRole = user.app_metadata?.role;
        const userRole = user.user_metadata?.role;
        if (appRole === "owner") counts.trustedOwner += 1;
        else if (appRole === "admin") counts.trustedAdmin += 1;
        else if (appRole === "user") counts.trustedUser += 1;
        else if (appRole == null || appRole === "") counts.missingAppRole += 1;
        else counts.invalidAppRole += 1;
        if (!appRole && ["admin", "owner"].includes(userRole)) counts.legacyPrivilegedOnly += 1;
        if (appRole && userRole && appRole !== userRole) counts.metadataMismatch += 1;
      }
      if (data.users.length < 100) break;
    }
    console.log(JSON.stringify({ projectHost: new URL(url).host, readOnly: true, counts }, null, 2));
    if (counts.legacyPrivilegedOnly || counts.invalidAppRole || !counts.trustedOwner) {
      console.error("Review required before rollout. Do not promote accounts from user_metadata automatically.");
      process.exitCode = 2;
    }
  } catch {
    console.error("Role audit could not complete. Check backend credentials/network; no changes were made.");
    process.exitCode = 1;
  }
}
