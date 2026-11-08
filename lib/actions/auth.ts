"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/account";
import { findAccountByUsername, isUsernameTaken } from "@/lib/auth";
import { retryAfterMessage, type RateLimitRule, type RateLimitVerdict } from "@/lib/rate-limit";
import { forgetSharedRateLimit, sharedRateLimit } from "@/lib/rate-limit-shared";
import { clientIp } from "@/lib/request-ip";
import { getSiteUrl } from "@/lib/site-url";
import { isSupabaseConfigured, NO_SUPABASE_ERROR } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD } from "@/lib/turnstile/config";
import { verifyTurnstile } from "@/lib/turnstile/verify";
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

/**
 * Sign-in attempts one address may make. Loose enough that somebody who cannot
 * remember which of their passwords it was still gets there.
 */
const SIGN_IN_PER_IP: RateLimitRule = { limit: 10, windowMs: 10 * 60_000 };

/**
 * And attempts against one username, whoever is making them. The per-address
 * limit alone is worth little against a botnet: spread over enough addresses,
 * every one of them stays inside its budget while the account underneath takes
 * thousands of guesses. This is the half of the pair that notices that.
 */
const SIGN_IN_PER_USERNAME: RateLimitRule = { limit: 5, windowMs: 15 * 60_000 };

/** New accounts one address may open. Real people need one, and rarely two. */
const SIGN_UP_PER_IP: RateLimitRule = { limit: 5, windowMs: 60 * 60_000 };

const TOO_MANY_SIGN_UPS =
  "Se han creado demasiadas cuentas desde aquí. Vuelve a intentarlo más tarde.";

/** The address the attempt came from, as far as the proxy in front will say. */
async function callerAddress(): Promise<string | null> {
  return clientIp(await headers());
}

/**
 * The first budget that is spent, or null while there is room in all of them.
 * Every one is counted before the answer is read: an attempt that trips the
 * per-address limit is still an attempt against that username.
 */
function firstBlocked(verdicts: (RateLimitVerdict | null)[]): RateLimitVerdict | null {
  return verdicts.find((verdict) => verdict !== null && !verdict.allowed) ?? null;
}

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
  // Said plainly, and before the credentials are even looked at: the alternative
  // is BAD_CREDENTIALS below, which would blame the person for a password that
  // was never going to be checked against anything.
  if (!isSupabaseConfigured) return { error: NO_SUPABASE_ERROR };

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = formData.get("next");

  if (!username || !password) {
    return { error: "Ingresa tu usuario y contraseña." };
  }

  // Counted before anything is looked up, and keyed twice: by address, and by
  // the account being aimed at. Without an address — nothing in front of the
  // app forwards one — only the second half applies, which still leaves the
  // accounts themselves covered.
  const address = await callerAddress();
  const usernameKey = `signin:user:${username}`;

  const blocked = firstBlocked(
    await Promise.all([
      address ? sharedRateLimit(`signin:ip:${address}`, SIGN_IN_PER_IP) : null,
      sharedRateLimit(usernameKey, SIGN_IN_PER_USERNAME),
    ])
  );
  if (blocked) return { error: retryAfterMessage(blocked.retryAfterSeconds) };

  // Ahead of the lookup below on purpose. That one runs with the service-role
  // key and answers "does this username exist?", which is precisely the work a
  // bot should not get to make us do for free.
  const captcha = await verifyTurnstile(formData.get(TURNSTILE_FIELD), "login");
  if (!captcha.ok) return { error: captcha.error };

  // Supabase Auth signs in by email, so the username has to be resolved first.
  const account = await findAccountByUsername(username);
  if (!account) return { error: BAD_CREDENTIALS };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (error) return { error: BAD_CREDENTIALS };

  // Signed in, so the failed tries before this were somebody mistyping their
  // own password: holding them against the account would be locking a person
  // out of one they just proved is theirs. The per-address count stays — that
  // one is not about the account.
  await forgetSharedRateLimit(usernameKey);

  revalidatePath("/", "layout");
  redirect(destinationFor(account.role, typeof next === "string" ? next : null));
}

export async function signUp(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NO_SUPABASE_ERROR };

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

  // After the form has been checked over, so a typo costs nobody part of their
  // budget, and before the first round trip to the database.
  const address = await callerAddress();
  if (address) {
    const verdict = await sharedRateLimit(`signup:ip:${address}`, SIGN_UP_PER_IP);
    if (!verdict.allowed) return { error: TOO_MANY_SIGN_UPS };
  }

  const captcha = await verifyTurnstile(formData.get(TURNSTILE_FIELD), "register");
  if (!captcha.ok) return { error: captcha.error };

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
  // Unreachable in practice — with no project the header never draws the form
  // this submits — but it is a public endpoint, so it answers for itself.
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Reset emails one address may ask for. Each one is a real email sent. */
const RESET_PER_IP: RateLimitRule = { limit: 5, windowMs: 60 * 60_000 };

/** And reset emails one account may receive, whoever asks: no inbox flooding. */
const RESET_PER_ACCOUNT: RateLimitRule = { limit: 3, windowMs: 60 * 60_000 };

/**
 * Sends the password-reset email. Takes the username or the email, since
 * people sign in with the first and may only remember one of the two. The
 * answer is the same whether or not an account was found — otherwise this form
 * would tell anyone which usernames and addresses are registered.
 */
export async function requestPasswordReset(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NO_SUPABASE_ERROR };

  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { error: "Ingresa tu usuario o tu correo." };

  const isEmail = identifier.includes("@");
  const key = isEmail ? identifier.toLowerCase() : normalizeUsername(identifier);
  if (isEmail) {
    const invalid = validateEmail(key);
    if (invalid) return { error: invalid };
  }

  const address = await callerAddress();
  const blocked = firstBlocked(
    await Promise.all([
      address ? sharedRateLimit(`reset:ip:${address}`, RESET_PER_IP) : null,
      sharedRateLimit(`reset:account:${key}`, RESET_PER_ACCOUNT),
    ])
  );
  if (blocked) return { error: retryAfterMessage(blocked.retryAfterSeconds) };

  const captcha = await verifyTurnstile(formData.get(TURNSTILE_FIELD), "recover");
  if (!captcha.ok) return { error: captcha.error };

  const email = isEmail ? key : (await findAccountByUsername(key))?.email;

  if (email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getSiteUrl()}/auth/confirm?next=/restablecer`,
    });
    // Logged, not shown: the reply below must not differ for an account that
    // exists. A failure here is ours (Resend, the hook), not the visitor's.
    if (error) console.error("requestPasswordReset —", error.message);
  }

  return {
    notice:
      "Si existe una cuenta con esos datos, te enviamos un correo con un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.",
  };
}

/**
 * Sets the new password after the reset link. That link went through
 * app/auth/confirm, which signed the person in — so the session itself is the
 * proof, and no current password is asked for.
 */
export async function resetPassword(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NO_SUPABASE_ERROR };

  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const invalid = validatePassword(password);
  if (invalid) return { error: invalid };
  if (password !== passwordConfirm) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "El enlace caducó. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("different")) {
      return { error: "La nueva contraseña debe ser distinta de la anterior." };
    }
    if (message.includes("password")) return { error: "Esa contraseña es demasiado débil." };
    return { error: "No pudimos cambiar la contraseña. Inténtalo de nuevo." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
