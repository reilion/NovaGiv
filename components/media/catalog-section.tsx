import { MediaGrid } from "@/components/media/media-grid";
import { VideoPlayerModal } from "@/components/player/video-player-modal";
import { filterAndSortMedia, parseFilterParams } from "@/lib/media-filter";
import { getMediaItems } from "@/lib/queries";
import { buildQueryString, type SearchParamsRecord } from "@/lib/url";

interface CatalogSectionProps {
  searchParams: SearchParamsRecord;
}

/**
 * Server Component: fetches the full catalog, applies the tab/search/genre/sort
 * filters from the URL, and renders the grid plus the player modal (open when
 * `?play=<slug>` is present). Keeping this on the server means filtering and
 * "which item is open" never need client-side state.
 */
export async function CatalogSection({ searchParams }: CatalogSectionProps) {
  const items = await getMediaItems();
  const filters = parseFilterParams(searchParams);
  const filteredItems = filterAndSortMedia(items, filters);

  const playSlug = typeof searchParams.play === "string" ? searchParams.play : undefined;
  const selectedItem = playSlug ? (items.find((item) => item.slug === playSlug) ?? null) : null;
  const closeHref = `?${buildQueryString(searchParams, { play: null })}`;

  return (
    <>
      <MediaGrid items={filteredItems} currentParams={searchParams} />
      <VideoPlayerModal item={selectedItem} closeHref={closeHref} />
    </>
  );
}
