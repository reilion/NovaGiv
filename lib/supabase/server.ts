import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Server Component / Route Handler client. Reads the current request's cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored: called from a Server Component that can't set cookies.
            // Safe as long as this catalog stays read-only / unauthenticated.
          }
        },
      },
    }
  );
}
