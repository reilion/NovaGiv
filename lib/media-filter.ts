import type { MediaItem, MediaType, SortOption } from "@/types/media";
import type { SearchParamsRecord } from "@/lib/url";

export interface FilterParams {
  type: MediaType | "all";
  search: string;
  genre: string;
  sort: SortOption;
}

export function parseFilterParams(searchParams: SearchParamsRecord): FilterParams {
  const rawTab = searchParams.tab;
  const rawGenre = searchParams.genre;
  const rawSort = searchParams.sort;
  const rawSearch = searchParams.q;

  return {
    type: typeof rawTab === "string" ? (rawTab as FilterParams["type"]) : "all",
    genre: typeof rawGenre === "string" ? rawGenre : "all",
    sort: typeof rawSort === "string" ? (rawSort as SortOption) : "recent",
    search: typeof rawSearch === "string" ? rawSearch : "",
  };
}

const ACCENTED_CHARS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
};

/** Strips Spanish accents so "codigo" matches "Código" in the search box. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (char) => ACCENTED_CHARS[char] ?? char);
}

export function filterAndSortMedia(
  items: MediaItem[],
  { type, search, genre, sort }: FilterParams
): MediaItem[] {
  const query = normalize(search.trim());

  const filtered = items.filter((item) => {
    const matchesType = type === "all" || item.type === type;
    const matchesGenre = genre === "all" || item.genres.includes(genre);
    const matchesSearch = query === "" || normalize(item.title).includes(query);
    return matchesType && matchesGenre && matchesSearch;
  });

  return filtered.sort((a, b) => {
    if (sort === "az") return a.title.localeCompare(b.title, "es");
    if (sort === "year") return (b.year ?? 0) - (a.year ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
