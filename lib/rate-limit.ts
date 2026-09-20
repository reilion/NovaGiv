/**
 * A fixed-window request counter, kept in the memory of whichever process asks.
 *
 * Deliberately without `server-only` and without any dependency: the proxy
 * counts in the edge runtime and the server actions count in Node, and neither
 * should have to reach for a database to find out that the same address has
 * tried to sign in forty times in a minute.
 *
 * What that buys and what it does not: each runtime, and each instance the host
 * happens to be running, keeps its own tally. On a single `next start` server
 * that is the whole picture; spread over several instances a flood gets the
 * budget multiplied by however many it lands on. It still turns "unlimited" into
 * "bounded", which is the point, and every caller goes through `rateLimit()` —
 * so the day this needs to be shared (Redis, or a Supabase table), this file is
 * the only one that changes.
 */

export interface RateLimitRule {
  /** How many attempts the window allows before it starts refusing. */
  limit: number;
  /** How long the window lasts, in milliseconds. */
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Attempts left in the current window; 0 once it is spent. */
  remaining: number;
  /** Seconds until the window resets. 0 while the attempt was allowed. */
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Ceiling on how many keys are tracked at once. Without it, somebody rotating
 * addresses would grow this map until the process ran out of memory — the
 * limiter would have become the easiest way to take the site down.
 */
const MAX_TRACKED_KEYS = 20_000;

const windows = new Map<string, Window>();

/**
 * Drops what has already expired, and if that was not enough, the oldest keys
 * still live. A Map iterates in insertion order, so those come first.
 */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }

  if (windows.size < MAX_TRACKED_KEYS) return;

  let toDrop = windows.size - MAX_TRACKED_KEYS + 1;
  for (const key of windows.keys()) {
    windows.delete(key);
    if (--toDrop <= 0) break;
  }
}

/**
 * Counts one attempt against `key` and says whether it fits in the budget.
 *
 * Keys are namespaced by their caller ("signin:ip:1.2.3.4", "views:ip:…") so
 * two unrelated limits never share a tally.
 */
export function rateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitVerdict {
  if (windows.size >= MAX_TRACKED_KEYS) sweep(now);

  const current = windows.get(key);
  // An expired window is replaced rather than reused: whoever was blocked a
  // window ago starts again from zero, which is what makes this a limit and
  // not a ban.
  const window =
    current && current.resetAt > now ? current : { count: 0, resetAt: now + rule.windowMs };

  window.count += 1;
  windows.set(key, window);

  const allowed = window.count <= rule.limit;

  return {
    allowed,
    remaining: Math.max(0, rule.limit - window.count),
    // Never 0 while blocked: "retry in 0 seconds" reads as "retry now", which
    // is the one thing that is not true here.
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

/**
 * Forgets a key. Called after a sign-in that worked: the failed guesses before
 * it were this person mistyping their own password, and holding those against
 * them would be locking somebody out of an account they just proved is theirs.
 */
export function forgetRateLimit(key: string): void {
  windows.delete(key);
}

/** "en 3 minutos" / "en un momento" — what every caller tells the person. */
export function retryAfterMessage(seconds: number): string {
  if (seconds <= 60) return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";

  const minutes = Math.ceil(seconds / 60);
  return `Demasiados intentos. Vuelve a intentarlo en ${minutes} minutos.`;
}
