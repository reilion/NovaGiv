/** Mirrors the `profiles` table in supabase/schema.sql. */

export type AccountRole = "user" | "admin";

export interface Account {
  id: string;
  /** Always lowercase — this is what the login form asks for. */
  username: string;
  email: string;
  role: AccountRole;
  /** ISO timestamp. Null only for an account whose profile row predates it. */
  createdAt: string | null;
}
