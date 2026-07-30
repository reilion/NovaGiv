import { normalizeSearch } from "@/lib/text";
import type { SearchParamsRecord } from "@/lib/url";
import type { MediaItem, MediaType, SortOption } from "@/types/media";

export interface FilterParams {
  type: MediaType | "all";
  search: string;
  genre: string;
  sort: SortOption;
  /** Stream year ("2024"), or "all". */
  year: string;
  /** Stream month as "1".."12", or "all". */
  month: string;
  /** Inclusive custom range, "YYYY-MM-DD". Empty when unset. */
  from: string;
  to: string;
}

const DEFAULT_SORT: SortOption = "streamed";

function str(value: string | string[] | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function parseFilterParams(searchParams: SearchParamsRecord): FilterParams {
  return {
    type: str(searchParams.tab, "all") as FilterParams["type"],
    genre: str(searchParams.genre, "all"),
    sort: str(searchParams.sort, DEFAULT_SORT) as SortOption,
    search: str(searchParams.q, ""),
    year: str(searchParams.year, "all"),
    month: str(searchParams.month, "all"),
    from: str(searchParams.from, ""),
    to: str(searchParams.to, ""),
  };
}

/** "YYYY-MM" keys covered by an item, from its episodes when known, else its range. */
function coveredMonths(item: MediaItem): string[] {
  const episodeDates = (item.episodes ?? [])
    .map((episode) => episode.streamedAt)
    .filter((value): value is string => Boolean(value));

  if (episodeDates.length > 0) {
    return [...new Set(episodeDates.map((date) => date.slice(0, 7)))];
  }

  const from = item.firstStreamedAt?.slice(0, 7);
  const to = item.lastStreamedAt?.slice(0, 7) ?? from;
  if (!from) return [];

  // Walk month by month so a collection spanning several months matches any of them.
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  const [endYear, endMonth] = (to ?? from).split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (months.length > 600) break; // guard against malformed data
  }
  return months;
}

/** Concrete dates an item was streamed on; used by the custom-range filter. */
function coveredDates(item: MediaItem): string[] {
  const episodeDates = (item.episodes ?? [])
    .map((episode) => episode.streamedAt)
    .filter((value): value is string => Boolean(value));
  if (episodeDates.length > 0) return episodeDates.map((date) => date.slice(0, 10));

  return [item.firstStreamedAt, item.lastStreamedAt]
    .filter((value): value is string => Boolean(value))
    .map((date) => date.slice(0, 10));
}

/** Every stream year present in the catalog, newest first — drives the year filter. */
export function collectStreamYears(items: MediaItem[]): number[] {
  const years = new Set<number>();
  for (const item of items) {
    for (const month of coveredMonths(item)) years.add(Number(month.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

/** Sort key for stream date; collections without dates sort last. */
function streamKey(item: MediaItem): string {
  return item.lastStreamedAt ?? item.firstStreamedAt ?? "";
}

export function filterAndSortMedia(
  items: MediaItem[],
  { type, search, genre, sort, year, month, from, to }: FilterParams
): MediaItem[] {
  const query = normalizeSearch(search.trim());
  const yearNum = year !== "all" && /^\d{4}$/.test(year) ? Number(year) : undefined;
  const monthNum = month !== "all" && /^\d{1,2}$/.test(month) ? Number(month) : undefined;
  const hasRange = Boolean(from || to);
  // An open-ended bound just means "no limit on that side".
  const rangeStart = from || "0000-01-01";
  const rangeEnd = to || "9999-12-31";

  const filtered = items.filter((item) => {
    if (type !== "all" && item.type !== type) return false;
    if (genre !== "all" && !item.genres.includes(genre)) return false;
    if (query && !normalizeSearch(item.title).includes(query)) return false;

    // A custom range replaces the year/month quick filters rather than
    // stacking with them, so the two can never contradict each other.
    if (hasRange) {
      const dates = coveredDates(item);
      return dates.some((date) => date >= rangeStart && date <= rangeEnd);
    }

    if (yearNum === undefined && monthNum === undefined) return true;

    return coveredMonths(item).some((key) => {
      const [itemYear, itemMonth] = key.split("-").map(Number);
      if (yearNum !== undefined && itemYear !== yearNum) return false;
      if (monthNum !== undefined && itemMonth !== monthNum) return false;
      return true;
    });
  });

  return filtered.sort((a, b) => {
    if (sort === "az") return a.title.localeCompare(b.title, "es");
    if (sort === "year") return (b.year ?? 0) - (a.year ?? 0);
    if (sort === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const keyA = streamKey(a);
    const keyB = streamKey(b);
    // Undated collections always sink to the bottom, in both directions.
    if (!keyA && !keyB) return 0;
    if (!keyA) return 1;
    if (!keyB) return -1;
    // Both are "YYYY-MM-DDTHH:MM:SS", so lexicographic === chronological.
    return sort === "streamed-asc" ? keyA.localeCompare(keyB) : keyB.localeCompare(keyA);
  });
}

export interface YearGroup {
  /** null for collections with no stream date at all. */
  year: number | null;
  items: MediaItem[];
}

/**
 * Splits the (already sorted) list into per-year sections for the default
 * view. A collection is filed under the year of its most recent stream, so it
 * appears exactly once; undated ones land in a trailing group.
 */
export function groupByStreamYear(items: MediaItem[], ascending = false): YearGroup[] {
  const groups = new Map<number | null, MediaItem[]>();

  for (const item of items) {
    const key = streamKey(item);
    const year = key ? Number(key.slice(0, 4)) : null;
    const bucket = groups.get(year);
    if (bucket) bucket.push(item);
    else groups.set(year, [item]);
  }

  return [...groups.entries()]
    .map(([year, groupItems]) => ({ year, items: groupItems }))
    .sort((a, b) => {
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return ascending ? a.year - b.year : b.year - a.year;
    });
}

/** Whether the current view should be split into year sections. */
export function shouldGroupByYear({ sort, year, from, to }: FilterParams): boolean {
  // Only the chronological sorts imply a year axis, and a view already
  // narrowed to one year (or a custom range) has nothing to split.
  if (sort !== "streamed" && sort !== "streamed-asc") return false;
  if (year !== "all") return false;
  if (from || to) return false;
  return true;
}
