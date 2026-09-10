import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin-Client mit service_role Key — umgeht RLS.
 * NUR in Server-Komponenten, API-Routes und Server Actions verwenden!
 * Niemals im Browser importieren.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY muss in .env.local gesetzt sein."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
