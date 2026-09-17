import { MediaGrid, MediaGridByYear } from "@/components/media/media-grid";
import {
  filterAndSortMedia,
  groupByStreamYear,
  parseFilterParams,
  shouldGroupByYear,
} from "@/lib/media-filter";
import { getMediaItems, getWatchHistory } from "@/lib/queries";
import { type SearchParamsRecord } from "@/lib/url";

interface CatalogSectionProps {
  searchParams: SearchParamsRecord;
}

/**
 * Server Component: fetches the full catalog and applies the
 * tab/search/genre/date filters from the URL. Keeping this on the server means
 * filtering never needs client-side state.
 *
 * Opening a video is a navigation to /v/[slug], not a param on this page, so
 * nothing here has to know which title is playing.
 */
export async function CatalogSection({ searchParams }: CatalogSectionProps) {
  // Both are request-cached, so the shelf above the grid shares this history.
  const [items, history] = await Promise.all([getMediaItems(), getWatchHistory()]);
  const filters = parseFilterParams(searchParams);
  const filteredItems = filterAndSortMedia(items, filters);

  // One row per collection, so this is at most "everything watched once".
  const watchedIds = new Set((history ?? []).map((entry) => entry.item.id));

  return shouldGroupByYear(filters) ? (
    <MediaGridByYear
      groups={groupByStreamYear(filteredItems, filters.sort === "streamed-asc")}
      search={filters.search}
      watchedIds={watchedIds}
    />
  ) : (
    <MediaGrid items={filteredItems} search={filters.search} watchedIds={watchedIds} />
  );
}
