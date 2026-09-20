/**
 * Whether the auth forms carry a Cloudflare Turnstile challenge, and the key
 * the widget needs to draw one.
 *
 * Its own module, and deliberately without `server-only`, for the same reason
 * lib/supabase/config.ts is: the widget asks in the browser and the server
 * actions ask in Node, and `NEXT_PUBLIC_*` is inlined at build time, so it is
 * the same answer in both. The secret half lives in ./verify.ts, which never
 * reaches the browser.
 *
 * Unset, the whole thing is off and the forms work exactly as they did before —
 * which is what keeps `pnpm dev` usable without a Cloudflare account. The rate
 * limits in the sign-in and sign-up actions do not depend on this and are
 * always on.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export const isTurnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

/**
 * The field Turnstile writes its token into. This is the name the widget uses
 * by default; naming it in one place is what stops the form and the action that
 * reads the form from drifting apart.
 */
export const TURNSTILE_FIELD = "cf-turnstile-response";
