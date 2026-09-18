"use server";

import { getCatalogPage } from "@/lib/catalog";
import { parseFilterParams } from "@/lib/media-filter";
import type { SearchParamsRecord } from "@/lib/url";
import type { CatalogPage } from "@/types/media";

/** Longer than any filter state the bar can produce; a bound on a public endpoint. */
const MAX_QUERY_LENGTH = 512;

/**
 * The next page of the catalog, for the infinite scroll.
 *
 * Takes the filters as the query string the grid was rendered with, so the
 * browser sends back exactly what is in its address bar and there is one place
 * that turns a URL into a query — `parseFilterParams`, which validates every
 * value before it reaches Postgres. A server action is a public POST endpoint,
 * so this assumes nothing about the caller: the page size is fixed here, not
 * asked for, and a nonsense filter reads as "unset" rather than failing.
 */
export async function loadCatalogPage(query: string, offset: number): Promise<CatalogPage> {
  const params = Object.fromEntries(
    new URLSearchParams(String(query ?? "").slice(0, MAX_QUERY_LENGTH))
  ) as SearchParamsRecord;

  return getCatalogPage(parseFilterParams(params), Math.max(0, Math.trunc(Number(offset) || 0)));
}
