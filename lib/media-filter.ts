import { streamYear } from "@/lib/stream-date";
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
}

export function parseFilterParams(searchParams: SearchParamsRecord): FilterParams {
  const rawTab = searchParams.tab;
  const rawGenre = searchParams.genre;
  const rawSort = searchParams.sort;
  const rawSearch = searchParams.q;
  const rawYear = searchParams.year;

  return {
    type: typeof rawTab === "string" ? (rawTab as FilterParams["type"]) : "all",
    genre: typeof rawGenre === "string" ? rawGenre : "all",
    sort: typeof rawSort === "string" ? (rawSort as SortOption) : "recent",
    search: typeof rawSearch === "string" ? rawSearch : "",
    year: typeof rawYear === "string" ? rawYear : "all",
  };
}

/** Every stream year present in the catalog, newest first — drives the year filter. */
export function collectStreamYears(items: MediaItem[]): number[] {
  const years = new Set<number>();
  for (const item of items) {
    const from = streamYear(item.firstStreamedAt);
    const to = streamYear(item.lastStreamedAt);
    // A collection spanning several years should match any of them.
    if (from && to) {
      for (let y = from; y <= to; y++) years.add(y);
    } else if (from ?? to) {
      years.add((from ?? to)!);
    }
  }
  return [...years].sort((a, b) => b - a);
}

function matchesStreamYear(item: MediaItem, year: number): boolean {
  const from = streamYear(item.firstStreamedAt);
  const to = streamYear(item.lastStreamedAt) ?? from;
  if (!from) return false;
  return year >= from && year <= (to ?? from);
}

/** Sort key for stream date; collections without dates sort last. */
function streamKey(item: MediaItem): string {
  return item.lastStreamedAt ?? item.firstStreamedAt ?? "";
}

export function filterAndSortMedia(
  items: MediaItem[],
  { type, search, genre, sort, year }: FilterParams
): MediaItem[] {
  const query = normalizeSearch(search.trim());
  const yearNum = year !== "all" ? Number(year) : undefined;

  const filtered = items.filter((item) => {
    const matchesType = type === "all" || item.type === type;
    const matchesGenre = genre === "all" || item.genres.includes(genre);
    const matchesSearch = query === "" || normalizeSearch(item.title).includes(query);
    const matchesYear =
      yearNum === undefined || Number.isNaN(yearNum) || matchesStreamYear(item, yearNum);
    return matchesType && matchesGenre && matchesSearch && matchesYear;
  });

  return filtered.sort((a, b) => {
    if (sort === "az") return a.title.localeCompare(b.title, "es");
    if (sort === "year") return (b.year ?? 0) - (a.year ?? 0);
    if (sort === "streamed" || sort === "streamed-asc") {
      const keyA = streamKey(a);
      const keyB = streamKey(b);
      // Undated collections always sink to the bottom, in both directions.
      if (!keyA && !keyB) return 0;
      if (!keyA) return 1;
      if (!keyB) return -1;
      // Both are "YYYY-MM-DDTHH:MM:SS", so lexicographic === chronological.
      return sort === "streamed" ? keyB.localeCompare(keyA) : keyA.localeCompare(keyB);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
