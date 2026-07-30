import { FilterBar } from "@/components/filters/filter-bar";
import { collectStreamYears } from "@/lib/media-filter";
import { getMediaItems } from "@/lib/queries";

/**
 * Server wrapper that feeds the client FilterBar the list of years actually
 * present in the catalog. Lives inside its own Suspense boundary so awaiting
 * the catalog here doesn't delay the rest of the page; `getMediaItems` is
 * request-cached, so this shares the query with the grid.
 */
export async function FilterBarContainer() {
  const items = await getMediaItems();
  return <FilterBar streamYears={collectStreamYears(items)} />;
}
