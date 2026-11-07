export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * Where to send someone who needs to sign in first, remembering the page they
 * were after. Used by the /admin gate in the middleware and by the auth forms.
 */
export function loginPath(next?: string): string {
  const target = next ? safeRedirectPath(next) : null;
  return target ? `/login?next=${encodeURIComponent(target)}` : "/login";
}

/** A throwaway origin to resolve against: anything that leaves it was not a path. */
const PROBE_ORIGIN = "http://redirect.invalid";

/**
 * Sanitizes a `?next=` value before redirecting to it, so the login form and
 * the email links can never be turned into an open redirect.
 *
 * Checking prefixes is not enough: the URL parser browsers use strips tabs and
 * newlines, so `/\t/evil.com` passes a "starts with / but not //" test and then
 * lands on `//evil.com`. Instead the value is resolved the way a browser would
 * and must stay on the same origin; what comes back is the normalized path, not
 * the raw input.
 */
export function safeRedirectPath(value: string | undefined | null): string | null {
  if (!value || !value.startsWith("/")) return null;
  // Control characters and backslashes have no business in one of our paths,
  // and both are what browsers "repair" into something else.
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== PROBE_ORIGIN) return null;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // Belt and braces: a normalized path can never start with `//` and still be ours.
  return path.startsWith("//") ? null : path;
}

/**
 * Identity of the filter state of a URL, used to key the catalog's Suspense
 * boundary so the skeleton reappears while a newly filtered grid streams in.
 * Sorted so two URLs carrying the same filters in a different order share one
 * key.
 */
export function filterStateKey(current: SearchParamsRecord): string {
  return Object.entries(current)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .sort()
    .join("&");
}
