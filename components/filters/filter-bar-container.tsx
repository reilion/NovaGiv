import { FilterBar } from "@/components/filters/filter-bar";
import { getCatalogFacets } from "@/lib/catalog";

/**
 * Server wrapper that feeds the client FilterBar the years and genres actually
 * present in the catalog — neither is a list kept by hand.
 *
 * One aggregate query rather than a pass over the loaded catalog: the grid no
 * longer holds the whole thing, and the options have to cover what the filters
 * can reach, not what the current page happens to show. Lives inside its own
 * Suspense boundary so awaiting it here doesn't delay the rest of the page.
 */
export async function FilterBarContainer() {
  const { genres, streamYears } = await getCatalogFacets();

  return <FilterBar streamYears={streamYears} genres={genres} />;
}
