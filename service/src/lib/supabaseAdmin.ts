import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

/** Service-role client — trusted backend only, bypasses RLS. Never expose to a browser. */
export const supabaseAdmin = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
