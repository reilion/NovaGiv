import "server-only";

import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loginPath } from "@/lib/url";
import type { Account, AccountRole } from "@/types/account";

function toRole(value: unknown): AccountRole {
  return value === "admin" ? "admin" : "user";
}

/** The signed-in account (auth user + its profile row), or null for a visitor. */
export async function getAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, email, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  // A user with no profile row can only come from an account created straight
  // in the Supabase dashboard before the trigger existed. Show it as a plain
  // user rather than breaking the page it is rendered on.
  return {
    id: user.id,
    username: profile?.username ?? user.email?.split("@")[0] ?? "cuenta",
    email: profile?.email ?? user.email ?? "",
    role: toRole(profile?.role),
    createdAt: profile?.created_at ?? user.created_at ?? null,
  };
}

/**
 * Every admin action requires an admin account; RLS enforces it too (see
 * `is_admin()` in supabase/schema.sql), this just fails fast with a redirect
 * instead of a wall of empty results.
 */
export async function requireAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(loginPath("/admin"));

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Signed in, but as a visitor: /admin is not theirs, and bouncing them to the
  // login form would only loop, so send them back to the catalog.
  if (toRole(profile?.role) !== "admin") redirect("/");

  return supabase;
}

/**
 * The account behind a username, looked up with the service-role key because
 * this runs before there is a session. Returns the email Supabase Auth expects
 * plus the role, so the caller knows where to land the user after signing in.
 */
export async function findAccountByUsername(
  username: string
): Promise<{ email: string; role: AccountRole } | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("email, role")
    .eq("username", username)
    .maybeSingle();

  if (!data?.email) return null;

  return { email: data.email, role: toRole(data.role) };
}

/**
 * Re-asks for the password before a change that could lock someone out of
 * their own account (a new email, a new password).
 *
 * The check runs on a throwaway client: signing in through the request's own
 * client would rewrite the session cookies of the person doing it, and signing
 * *out* of the throwaway session is worse still — Supabase revokes every
 * session of that account by default, which would kick them out everywhere.
 * The extra refresh token this leaves behind is never stored and expires on its
 * own.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return !error;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  return Boolean(data);
}
