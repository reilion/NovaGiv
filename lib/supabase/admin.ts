import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS and carries no user session, so it must
 * never be reached from a Client Component (hence `server-only`).
 *
 * Logging in by username needs it. Supabase Auth only knows emails, so the
 * username has to be resolved to one *before* there is a session — a read of
 * somebody else's profile row, which no browser-side policy may ever allow
 * (see the profiles policies in supabase/schema.sql).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY: sin esa clave no se puede resolver el usuario a su correo al iniciar sesión."
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
