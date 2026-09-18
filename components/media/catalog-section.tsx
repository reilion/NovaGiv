import { CatalogFeed } from "@/components/media/catalog-feed";
import { getCatalogPage } from "@/lib/catalog";
import { parseFilterParams, shouldGroupByYear } from "@/lib/media-filter";
import { filterStateKey, type SearchParamsRecord } from "@/lib/url";

interface CatalogSectionProps {
  searchParams: SearchParamsRecord;
}

/**
 * Server Component: loads the first page of the catalog for the
 * tab/search/genre/date filters in the URL.
 *
 * The filtering, the ordering and the counters are all Postgres' work now (see
 * `search_media` in supabase/schema.sql), so this asks for one page and nothing
 * else — the rest arrives through the feed below as the visitor scrolls.
 *
 * Opening a video is a navigation to /v/[slug], not a param on this page, so
 * nothing here has to know which title is playing.
 */
export async function CatalogSection({ searchParams }: CatalogSectionProps) {
  const filters = parseFilterParams(searchParams);
  const page = await getCatalogPage(filters);

  // The filters as the feed will send them back when it asks for page two.
  // Rebuilt from the parsed values rather than forwarded raw, so what the
  // scroll continues is exactly the result that was rendered.
  const query = new URLSearchParams(
    Object.entries({
      tab: filters.type,
      q: filters.search,
      genre: filters.genre,
      sort: filters.sort,
      year: filters.year,
      month: filters.month,
      from: filters.from,
      to: filters.to,
    }).filter(([, value]) => value && value !== "all")
  ).toString();

  return (
    <CatalogFeed
      // A filter change is a new result, not more of the current one: re-keying
      // drops whatever the previous scroll had accumulated.
      key={filterStateKey(searchParams)}
      initial={page}
      query={query}
      grouped={shouldGroupByYear(filters)}
      ascending={filters.sort === "streamed-asc"}
    />
  );
}
