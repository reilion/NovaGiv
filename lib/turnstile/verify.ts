import "server-only";

import { isTurnstileEnabled, type TurnstileAction } from "@/lib/turnstile/config";

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
 *
 * Three conditions, not one. `success` alone says "somebody, somewhere, passed
 * a challenge for this sitekey"; the other two say it was *this* form on *this*
 * site. See `expectedHostnames` below for why the third is the one that matters.
 */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Long enough for a slow round trip, short enough that a form never hangs. */
const TIMEOUT_MS = 5_000;

/**
 * Turnstile tokens run to about 2 KB. Anything longer was not minted by
 * Cloudflare, so it is refused here rather than posted back to them — there is
 * no reason to let somebody use this endpoint to send Cloudflare whatever they
 * like, at whatever size they like.
 */
const MAX_TOKEN_LENGTH = 2048;

const NOT_COMPLETED =
  "No se completó la verificación anti-robots. Espera a que termine de cargar y vuelve a intentarlo.";
const REJECTED =
  "La verificación anti-robots no pasó. Recarga la página e inténtalo de nuevo.";
const UNAVAILABLE =
  "No pudimos comprobar la verificación anti-robots. Vuelve a intentarlo en un momento.";
const MISCONFIGURED =
  "La verificación anti-robots está mal configurada en este sitio. Avisa a un administrador.";

/**
 * The hostnames a token is allowed to have been minted on, or null when the
 * deployment has not said which site it is.
 *
 * This is the check that does the real work, and leaving it out is the mistake
 * worth naming: a sitekey is public by design, and the widget's domain list has
 * to include `localhost` for the challenge to draw during development. Without
 * this, somebody could serve the same widget from their own machine, solve it
 * there, and spend the token here — `success` would be perfectly true, and the
 * captcha would be worth nothing against anyone willing to do that at volume.
 *
 * So `localhost` and `127.0.0.1` are accepted only while this is not a
 * production build, and never alongside a real domain.
 *
 * Read once, at import: neither of these changes while the process runs, and
 * `SITE_URL` is the same variable lib/site-url.ts reads for the same purpose.
 */
const expectedHostnames: Set<string> | null = (() => {
  if (process.env.NODE_ENV !== "production") return new Set(["localhost", "127.0.0.1"]);

  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const configured =
    process.env.SITE_URL ?? (vercelDomain ? `https://${vercelDomain}` : undefined);
  if (!configured) return null;

  try {
    const { hostname } = new URL(configured.includes("://") ? configured : `https://${configured}`);
    return hostname ? new Set([hostname]) : null;
  } catch {
    return null;
  }
})();

export type TurnstileResult = { ok: true } | { ok: false; error: string };

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyTurnstile(
  token: FormDataEntryValue | null,
  expectedAction: TurnstileAction
): Promise<TurnstileResult> {
  if (!isTurnstileEnabled) return { ok: true };

  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Half-configured: the widget renders because the site key is public and set,
  // but there is nothing here to check its answer with. Refusing is the only
  // honest response — accepting would mean a challenge nobody ever marks.
  if (!secret) {
    console.error("Turnstile — NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not.");
    return { ok: false, error: MISCONFIGURED };
  }

  // Same shape of mistake, and the more dangerous one, because nothing on
  // screen would look wrong: a challenge that is verified but not tied to this
  // site is a challenge anybody can pass somewhere else.
  if (!expectedHostnames) {
    console.error(
      "Turnstile — set SITE_URL to this site's canonical origin. Without it there is no hostname to check a token against, and a token minted anywhere else would be accepted."
    );
    return { ok: false, error: MISCONFIGURED };
  }

  const response = typeof token === "string" ? token.trim() : "";
  if (!response) return { ok: false, error: NOT_COMPLETED };
  if (response.length > MAX_TOKEN_LENGTH) return { ok: false, error: REJECTED };

  let result: SiteverifyResponse;
  try {
    const body = new URLSearchParams({ secret, response });

    // `remoteip` is not sent on purpose: Cloudflare then requires it to match
    // the address the token was issued to, and the address this app sees
    // depends on whatever proxy is in front of it (see lib/request-ip.ts).
    // Getting that wrong would fail real people, and with the hostname checked
    // below it buys little next to a token that is single-use.
    const answer = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!answer.ok) throw new Error(`siteverify respondió ${answer.status}`);
    result = (await answer.json()) as SiteverifyResponse;
  } catch (error) {
    // Closed, not open. Letting attempts through when Cloudflare cannot be
    // reached sounds like the kind thing to do until you notice who reaches
    // that branch: a flood is exactly what makes these calls time out, so the
    // captcha would switch itself off at the moment it is needed most. The
    // message says "in a moment" rather than blaming the password, so a real
    // outage does not read as somebody's own mistake.
    console.error("Turnstile — siteverify unreachable, refusing the attempt:", error);
    return { ok: false, error: UNAVAILABLE };
  }

  if (!result.success) {
    const codes = result["error-codes"] ?? [];
    console.error("Turnstile — rejected:", codes.join(", ") || "sin código");

    // The site key and the secret belong to different widgets, or the secret is
    // wrong. Nothing the person can do about it, so do not tell them to retry.
    if (codes.includes("invalid-input-secret") || codes.includes("bad-request")) {
      return { ok: false, error: MISCONFIGURED };
    }

    return { ok: false, error: REJECTED };
  }

  // Verified, but for what and for whom? A token from the sign-up form spent on
  // the sign-in form, or one minted on a copy of this widget served somewhere
  // else, both arrive here with `success: true`.
  if (result.action !== expectedAction || !expectedHostnames.has(result.hostname ?? "")) {
    console.error(
      `Turnstile — token verified but out of place: action=${result.action}, hostname=${result.hostname} (esperado action=${expectedAction}, hostname∈${[...expectedHostnames].join("|")}).`
    );
    return { ok: false, error: REJECTED };
  }

  return { ok: true };
}
