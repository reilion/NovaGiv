import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Every admin action requires a logged-in Supabase user; RLS enforces it too, this just fails fast with a clear redirect. */
export async function requireAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  return supabase;
}
