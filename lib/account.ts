/**
 * Shape of an account as the sign-up form may create it. Pure helpers only:
 * this module is imported from both the forms (client) and the server actions,
 * and the rules here mirror the check constraint on `profiles.username` in
 * supabase/schema.sql — keep the two in step.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * What the `pattern` attribute of the username input accepts. Uppercase is
 * allowed here and folded away by normalizeUsername: typing "Kevin" should log
 * you into "kevin", not trip a validation error.
 */
export const USERNAME_INPUT_PATTERN = `[A-Za-z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}`;

const NORMALIZED_USERNAME_REGEX = new RegExp(
  `^[a-z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`
);

// Deliberately loose: the real check is Supabase's, and the one thing worth
// catching here is a typo'd address the confirmation mail would bounce off.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Names that would let an account pass itself off as part of the staff.
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrador",
  "administrator",
  "moderador",
  "moderator",
  "root",
  "soporte",
  "support",
  "staff",
  "novagiv",
]);

/** Usernames are case-insensitive: "Kevin" and "kevin" are the same account. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns the message to show, or null when the value is acceptable. */
export function validateUsername(username: string): string | null {
  if (!username) return "Elige un nombre de usuario.";
  if (!NORMALIZED_USERNAME_REGEX.test(username)) {
    return `El usuario debe tener entre ${USERNAME_MIN_LENGTH} y ${USERNAME_MAX_LENGTH} caracteres y solo letras, números o guion bajo.`;
  }
  if (RESERVED_USERNAMES.has(username)) return "Ese nombre de usuario está reservado.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return "Ingresa tu correo.";
  if (!EMAIL_REGEX.test(email)) return "Ese correo no parece válido.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Ingresa una contraseña.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}
