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
