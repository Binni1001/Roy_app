import { createApp } from "./app.ts";
import { createTokenVerifier } from "./auth.ts";
import { supabaseStore } from "./store.ts";
import { supabaseActions } from "./storeActions.ts";
import { supabaseMatches } from "./storeMatches.ts";
import { supabaseExtras } from "./storeExtras.ts";
import { supabaseOnboarding } from "./storeOnboarding.ts";
import { supabasePlanning } from "./storePlanning.ts";
import { supabasePeople } from "./storePeople.ts";

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Điểm vào cho Vercel: xuất app Hono làm default export.
export default createApp({
  verify: createTokenVerifier(process.env),
  store: { ...supabaseStore, ...supabaseExtras, ...supabaseActions, ...supabaseMatches, ...supabaseOnboarding, ...supabasePlanning, ...supabasePeople },
  corsOrigins,
});
