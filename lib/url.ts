export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * Builds a query string from the current search params plus a set of updates.
 * A `null` update value removes that key. Used to keep the filter bar, media
 * cards, and player modal all in sync with the URL (no client-side item state
 * needed for "which item is open").
 */
export function buildQueryString(
  current: SearchParamsRecord,
  updates: Record<string, string | null> = {}
): string {
  const params = new URLSearchParams();

  Object.entries(current).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) params.delete(key);
    else params.set(key, value);
  });

  return params.toString();
}

/**
 * Where to send someone who needs to sign in first, remembering the page they
 * were after. Used by the /admin gate in the middleware and by the auth forms.
 */
export function loginPath(next?: string): string {
  const target = next ? safeRedirectPath(next) : null;
  return target ? `/login?next=${encodeURIComponent(target)}` : "/login";
}

/**
 * Sanitizes a `?next=` value before redirecting to it. Anything that is not a
 * plain in-site path — an absolute URL, a protocol-relative `//evil.com`, a
 * backslash Windows and some browsers normalize into one — is dropped, so the
 * login form can never be turned into an open redirect.
 */
export function safeRedirectPath(value: string | undefined | null): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * Identity of the *filter* state of a URL, used to key the catalog's Suspense
 * boundary. `play` is deliberately left out: which video is open changes the
 * modal, not the grid, so keying on it would tear the whole catalog down and
 * rebuild it from the skeleton on every open and close. Sorted so two URLs
 * carrying the same filters in a different order share one key.
 */
export function filterStateKey(current: SearchParamsRecord): string {
  return Object.entries(current)
    .filter(([key, value]) => key !== "play" && value !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .sort()
    .join("&");
}
