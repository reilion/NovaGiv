import "server-only";

import { isTurnstileEnabled } from "@/lib/turnstile/config";

/**
 * Checks the token a Turnstile widget produced against Cloudflare.
 *
 * The check is done here rather than handed to Supabase (which can verify a
 * captcha itself, under Authentication -> Attack Protection) for one reason:
 * signing in resolves the username to an email first, with the service-role
 * key, and that lookup is work a bot should never get to make us do. Verifying
 * in the action puts the challenge in front of it.
 *
 * Which means the two must not both be on. A token is single-use — whoever
 * redeems it first wins and the other gets `timeout-or-duplicate` — so leave
 * Supabase's own captcha setting off while this is in use.
 */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Long enough for a slow round trip, short enough that a form never hangs. */
const TIMEOUT_MS = 5_000;

const NOT_COMPLETED =
  "No se completó la verificación anti-robots. Espera a que termine de cargar y vuelve a intentarlo.";
const REJECTED =
  "La verificación anti-robots no pasó. Recarga la página e inténtalo de nuevo.";
const MISCONFIGURED =
  "La verificación anti-robots está mal configurada en este sitio. Avisa a un administrador.";

export type TurnstileResult = { ok: true } | { ok: false; error: string };

interface SiteverifyResponse {
  success?: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstile(token: FormDataEntryValue | null): Promise<TurnstileResult> {
  if (!isTurnstileEnabled) return { ok: true };

  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Half-configured: the widget renders because the site key is public and set,
  // but there is nothing here to check its answer with. Refusing is the only
  // honest response — accepting would mean a challenge nobody ever marks.
  if (!secret) {
    console.error("Turnstile — NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not.");
    return { ok: false, error: MISCONFIGURED };
  }

  const response = typeof token === "string" ? token.trim() : "";
  if (!response) return { ok: false, error: NOT_COMPLETED };

  let result: SiteverifyResponse;
  try {
    const body = new FormData();
    body.set("secret", secret);
    body.set("response", response);

    // `remoteip` is not sent on purpose: Cloudflare then requires it to match
    // the address the token was issued to, and the address this app sees
    // depends on whatever proxy is in front of it (see lib/request-ip.ts).
    // Getting that wrong would fail real people, and the binding buys little
    // next to a token that is single-use and expires in five minutes.
    const answer = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    result = (await answer.json()) as SiteverifyResponse;
  } catch (error) {
    // Cloudflare unreachable. Failing closed here would mean their outage locks
    // everyone out of their own accounts, and this is not a failure an attacker
    // can bring about from outside — so it opens, and the rate limits in the
    // sign-in and sign-up actions are what still stands in the way.
    console.error("Turnstile — siteverify unreachable, letting the attempt through:", error);
    return { ok: true };
  }

  if (result.success) return { ok: true };

  const codes = result["error-codes"] ?? [];
  console.error("Turnstile — rejected:", codes.join(", ") || "sin código");

  // The site key and the secret belong to different widgets, or the secret is
  // wrong. Nothing the person can do about it, so do not tell them to retry.
  if (codes.includes("invalid-input-secret") || codes.includes("bad-request")) {
    return { ok: false, error: MISCONFIGURED };
  }

  return { ok: false, error: REJECTED };
}
