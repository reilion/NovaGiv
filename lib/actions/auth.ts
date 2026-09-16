"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/account";
import { findAccountByUsername, isUsernameTaken } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/url";
import type { AccountRole } from "@/types/account";

export interface AuthState {
  error?: string;
  /** Shown instead of a redirect when the account still needs confirming. */
  notice?: string;
}

// Same message whether the username exists or the password is wrong: telling
// the two apart would turn the form into a "does this account exist?" oracle.
const BAD_CREDENTIALS = "Usuario o contraseña incorrectos.";

/** /admin is for admins; anyone else who asked for it lands on the catalog. */
function destinationFor(role: AccountRole, next: string | null): string {
  const target = safeRedirectPath(next);

  if (!target) return role === "admin" ? "/admin" : "/";
  if (target.startsWith("/admin") && role !== "admin") return "/";

  return target;
}

export async function signIn(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = formData.get("next");

  if (!username || !password) {
    return { error: "Ingresa tu usuario y contraseña." };
  }

  // Supabase Auth signs in by email, so the username has to be resolved first.
  const account = await findAccountByUsername(username);
  if (!account) return { error: BAD_CREDENTIALS };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (error) return { error: BAD_CREDENTIALS };

  revalidatePath("/", "layout");
  redirect(destinationFor(account.role, typeof next === "string" ? next : null));
}

export async function signUp(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const invalid =
    validateUsername(username) ?? validateEmail(email) ?? validatePassword(password);
  if (invalid) return { error: invalid };

  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  if (await isUsernameTaken(username)) {
    return { error: "Ese nombre de usuario ya está en uso." };
  }

  const supabase = await createClient();
  // The role is not part of this payload on purpose: the trigger behind
  // auth.users writes every new profile as 'user' (see supabase/schema.sql), so
  // there is nothing here a crafted request could escalate.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      // Only used when the project asks for a confirmation: it sends the link
      // through app/auth/confirm, which signs the account in on arrival.
      emailRedirectTo: `${await getSiteUrl()}/auth/confirm`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();

    // The profile insert runs inside the sign-up transaction, so a username
    // claimed between the check above and now surfaces as a generic database
    // error. It is the only constraint that trigger can trip.
    if (message.includes("database error")) {
      return { error: "Ese nombre de usuario ya está en uso." };
    }
    if (message.includes("already registered") || message.includes("already been")) {
      return { error: "Ese correo ya tiene una cuenta." };
    }
    if (message.includes("password")) {
      return { error: "Esa contraseña es demasiado débil." };
    }

    return { error: "No pudimos crear la cuenta. Inténtalo de nuevo." };
  }

  // No session means the project has email confirmation switched on. The same
  // message goes out whether or not the address was already taken — Supabase
  // hides that on purpose, and so do we.
  if (!data.session) {
    return {
      notice: `Te enviamos un correo a ${email} para confirmar la cuenta. Ábrelo y luego inicia sesión con tu usuario.`,
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
