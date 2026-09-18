"use server";

import { revalidatePath } from "next/cache";

import {
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/account";
import { getAccount, isUsernameTaken, verifyPassword } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { isSupabaseConfigured, NO_SUPABASE_ERROR } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface AccountState {
  error?: string;
  /** What went right, shown in place of an error under the form. */
  notice?: string;
}

const SESSION_GONE = "Tu sesión expiró. Vuelve a iniciar sesión.";
// Without a project getAccount() answers null for everyone, and SESSION_GONE
// would read as "you were signed out" to somebody who never could be.
const NO_ACCOUNTS = NO_SUPABASE_ERROR;
const WRONG_PASSWORD = "La contraseña actual no es correcta.";

export async function updateUsername(
  _prevState: AccountState | undefined,
  formData: FormData
): Promise<AccountState> {
  if (!isSupabaseConfigured) return { error: NO_ACCOUNTS };

  const account = await getAccount();
  if (!account) return { error: SESSION_GONE };

  const username = normalizeUsername(String(formData.get("username") ?? ""));

  if (username === account.username) {
    return { notice: "Ese ya es tu nombre de usuario." };
  }

  const invalid = validateUsername(username);
  if (invalid) return { error: invalid };

  if (await isUsernameTaken(username)) {
    return { error: "Ese nombre de usuario ya está en uso." };
  }

  // Only the username column is writable from a session — see the grant in
  // supabase/schema.sql — so this cannot touch the role even if it tried.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", account.id);

  if (error) {
    // 23505: the unique index caught a name claimed between the check and now.
    if (error.code === "23505") return { error: "Ese nombre de usuario ya está en uso." };
    return { error: "No pudimos guardar el cambio. Inténtalo de nuevo." };
  }

  revalidatePath("/", "layout");
  return { notice: `Listo. A partir de ahora inicias sesión como ${username}.` };
}

export async function updateEmail(
  _prevState: AccountState | undefined,
  formData: FormData
): Promise<AccountState> {
  if (!isSupabaseConfigured) return { error: NO_ACCOUNTS };

  const account = await getAccount();
  if (!account) return { error: SESSION_GONE };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const invalid = validateEmail(email);
  if (invalid) return { error: invalid };

  if (email === account.email) return { notice: "Ese ya es tu correo." };
  if (!password) return { error: "Confirma el cambio con tu contraseña actual." };
  if (!(await verifyPassword(account.email, password))) return { error: WRONG_PASSWORD };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${await getSiteUrl()}/auth/confirm?next=/account` }
  );

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already")) return { error: "Ese correo ya está en uso." };
    return { error: "No pudimos cambiar el correo. Inténtalo de nuevo." };
  }

  // Nothing has changed yet: auth.users keeps the old address until the link is
  // opened, and the trigger behind it only then copies the new one over.
  return {
    notice: `Te enviamos un enlace a ${email}. El correo cambia cuando lo abras, y puede que Supabase te pida confirmarlo también desde el anterior.`,
  };
}

export async function updatePassword(
  _prevState: AccountState | undefined,
  formData: FormData
): Promise<AccountState> {
  if (!isSupabaseConfigured) return { error: NO_ACCOUNTS };

  const account = await getAccount();
  if (!account) return { error: SESSION_GONE };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!currentPassword) return { error: "Ingresa tu contraseña actual." };

  const invalid = validatePassword(password);
  if (invalid) return { error: invalid };

  if (password !== passwordConfirm) return { error: "Las contraseñas no coinciden." };
  if (password === currentPassword) {
    return { error: "La nueva contraseña debe ser distinta de la actual." };
  }
  if (!(await verifyPassword(account.email, currentPassword))) return { error: WRONG_PASSWORD };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("different")) {
      return { error: "La nueva contraseña debe ser distinta de la actual." };
    }
    if (message.includes("password")) return { error: "Esa contraseña es demasiado débil." };
    return { error: "No pudimos cambiar la contraseña. Inténtalo de nuevo." };
  }

  return { notice: "Contraseña actualizada. La usarás la próxima vez que inicies sesión." };
}
