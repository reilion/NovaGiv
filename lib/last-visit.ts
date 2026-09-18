/**
 * "Nuevo" on a card means "added since you were last here". That needs two
 * moments per browser: when this visit's baseline is (`since`), and when the
 * browser was last seen (`last`), which is what becomes the baseline of the
 * *next* visit. Both live in one cookie that proxy.ts keeps up to date.
 *
 * A cookie rather than a column on profiles, because most of the catalog's
 * visitors never sign in, and they are the ones a reason to come back is for.
 */

export const LAST_VISIT_COOKIE = "novagiv_visit";

/**
 * Longer than this without a request and the next one opens a new visit. The
 * usual analytics session timeout: short enough that coming back in the evening
 * is a new visit, long enough that reading one title is not several.
 */
const VISIT_GAP_MS = 30 * 60 * 1000;

/** Rewriting the cookie on every prefetch would be noise; this is precise enough. */
const REFRESH_EVERY_MS = 60 * 1000;

/** A year, in seconds: a visitor coming back after months should still see what is new. */
export const LAST_VISIT_MAX_AGE = 60 * 60 * 24 * 365;

export interface VisitState {
  /** Epoch ms of the last request seen from this browser. */
  last: number;
  /** Epoch ms things are "new" after. Null during the very first visit. */
  since: number | null;
}

/** "<last>" or "<last>.<since>", both epoch ms. Anything else is a fresh start. */
export function parseVisitCookie(value: string | undefined): VisitState | null {
  const match = value?.match(/^(\d{1,15})(?:\.(\d{1,15}))?$/);
  if (!match) return null;

  return { last: Number(match[1]), since: match[2] ? Number(match[2]) : null };
}

export function serializeVisitCookie(state: VisitState): string {
  return state.since === null ? String(state.last) : `${state.last}.${state.since}`;
}

/**
 * The state after one more request at `now`, or null when the cookie can stay
 * as it is.
 *
 * On the very first visit there is no baseline, so nothing is new — a card
 * cannot be new to somebody who has never seen the catalog. From the second
 * visit on, the baseline is where the previous one ended, and it holds for the
 * whole visit so the badges do not vanish on the next click.
 */
export function nextVisitState(current: VisitState | null, now: number): VisitState | null {
  if (!current) return { last: now, since: null };

  if (now - current.last > VISIT_GAP_MS) return { last: now, since: current.last };

  if (now - current.last < REFRESH_EVERY_MS) return null;

  return { last: now, since: current.since };
}

/** What the catalog compares `created_at` against. Null = mark nothing. */
export function newSince(cookieValue: string | undefined): number | null {
  return parseVisitCookie(cookieValue)?.since ?? null;
}
