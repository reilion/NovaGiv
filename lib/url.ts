export type SearchParamsRecord = Record<string, string | string[] | undefined>;

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
