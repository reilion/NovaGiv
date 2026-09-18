import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { episodeParam } from "@/lib/episode-param";
import { LAST_VISIT_COOKIE, newSince } from "@/lib/last-visit";
import {
  collectGenres,
  collectStreamYears,
  filterAndSortMedia,
  matchingEpisodes,
  type FilterParams,
  type GenreCount,
} from "@/lib/media-filter";
import { MOCK_MEDIA } from "@/lib/mock-data";
import { getWatchedIds, isSupabaseConfigured } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  totalLikesOf,
  totalViewsOf,
  type CatalogCard,
  type CatalogItem,
  type CatalogPage,
  type CatalogYearCount,
  type MediaItem,
} from "@/types/media";

/**
 * The read half of the catalog grid.
 *
 * The grid used to be built by loading every published collection with every
 * one of its episodes and then filtering, sorting and counting in JavaScript.
 * With a channel of hundreds of streams that grows without a ceiling — in
 * payload, in memory and in time to first render — and it grows on *every*
 * request, because a filter is just a different slice of the same full load.
 *
 * Now Postgres does the filtering and the ordering (`search_media`), the
 * `media_catalog` view carries the counters that used to be summed per card,
 * and the browser asks for the next page only once it is about to need it.
 */

/**
 * Collections per page. The widest breakpoint draws six per row, so this is
 * four full rows — enough that the first screen is never short, small enough
 * that it is a fraction of what the whole catalog used to cost.
 */
export const CATALOG_PAGE_SIZE = 24;

export interface CatalogFacets {
  genres: GenreCount[];
  /** Years present in the catalog, newest first. */
  streamYears: number[];
}

/** One row of `search_media`'s json, before the nulls become optionals. */
interface CatalogRow {
  id: string;
  title: string;
  slug: string;
  type: CatalogItem["type"];
  posterUrl: string;
  genres: string[] | null;
  year: number | null;
  duration: string | null;
  status: CatalogItem["status"] | null;
  createdAt: string;
  firstStreamedAt: string | null;
  lastStreamedAt: string | null;
  episodeCount: number;
  views: number;
  likes: number;
  matchedEpisodes: number;
  matchedEpisodeRef: string | null;
}

interface SearchMediaResult {
  total: number;
  items: CatalogRow[];
  yearCounts: CatalogYearCount[];
}

function mapRow(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    posterUrl: row.posterUrl,
    genres: row.genres ?? [],
    year: row.year ?? undefined,
    duration: row.duration ?? undefined,
    status: row.status ?? undefined,
    createdAt: row.createdAt,
    // Postgres hands `timestamp` columns over as "2026-07-28T00:19:09"; kept as
    // a plain string so no timezone conversion ever happens.
    firstStreamedAt: row.firstStreamedAt ?? undefined,
    lastStreamedAt: row.lastStreamedAt ?? undefined,
    episodeCount: row.episodeCount,
    views: row.views,
    likes: row.likes,
    matchedEpisodes: row.matchedEpisodes,
    matchedEpisodeRef: row.matchedEpisodeRef ?? undefined,
  };
}

/** A mock item shaped like a catalog row — the demo catalog's half of the swap. */
function mockRow(item: MediaItem, search: string): CatalogItem {
  const matches = matchingEpisodes(item, search);

  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    type: item.type,
    posterUrl: item.posterUrl,
    genres: item.genres,
    year: item.year,
    duration: item.duration,
    status: item.status,
    createdAt: item.createdAt,
    firstStreamedAt: item.firstStreamedAt,
    lastStreamedAt: item.lastStreamedAt,
    episodeCount: item.episodes?.length ?? 0,
    views: totalViewsOf(item),
    likes: totalLikesOf(item),
    matchedEpisodes: matches.length,
    matchedEpisodeRef: matches[0] ? episodeParam(matches[0]) : undefined,
  };
}

/**
 * The year sections a set of collections falls into, filed by the year of the
 * most recent stream — the same rule as `groupByStreamYear`. Only the demo
 * catalog goes through here; against Supabase these counts come back from
 * `search_media`, which can count the whole result without loading it.
 */
function countByYear(
  items: Pick<MediaItem, "firstStreamedAt" | "lastStreamedAt">[]
): CatalogYearCount[] {
  const counts = new Map<number | null, number>();

  for (const item of items) {
    const key = item.lastStreamedAt ?? item.firstStreamedAt;
    const year = key ? Number(key.slice(0, 4)) : null;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()].map(([year, count]) => ({ year, count }));
}

/**
 * What this visitor makes of a page of results: which collections they have
 * already opened, and which ones are new since their previous visit.
 *
 * Resolved per page rather than handed down as two sets covering the catalog,
 * because under the infinite scroll a page can arrive long after the one before
 * it — and because "have I watched these 24?" is a keyed lookup, while "what
 * have I watched?" is the whole history.
 */
async function withViewerState(items: CatalogItem[]): Promise<CatalogCard[]> {
  if (items.length === 0) return [];

  const [watched, cookieStore] = await Promise.all([
    getWatchedIds(items.map((item) => item.id)),
    cookies(),
  ]);

  // Added since this browser's previous visit — see lib/last-visit.ts.
  const since = newSince(cookieStore.get(LAST_VISIT_COOKIE)?.value);

  return items.map((item) => {
    const isWatched = watched.has(item.id);
    return {
      ...item,
      watched: isWatched,
      // Anything already opened is left out: it is not news to whoever watched it.
      isNew: since !== null && !isWatched && Date.parse(item.createdAt) > since,
    };
  });
}

function pageFrom(
  items: CatalogItem[],
  total: number,
  offset: number,
  yearCounts: CatalogYearCount[]
): Omit<CatalogPage, "items"> & { items: CatalogItem[] } {
  const loaded = offset + items.length;
  return {
    items,
    total,
    // No page is ever short of the limit unless it is the last one, but trust
    // the total rather than the length: a collection unpublished between two
    // requests would otherwise leave the scroll asking forever.
    nextOffset: items.length > 0 && loaded < total ? loaded : null,
    yearCounts,
  };
}

/**
 * One page of the catalog for a set of filters.
 *
 * `offset` is a plain row offset, which is what makes a page cheap to ask for
 * from anywhere — the server for the first one, the infinite scroll for the
 * rest — without the browser having to carry a cursor. The ordering inside
 * `search_media` is total (it breaks every tie on `created_at` then `id`), so
 * consecutive pages cannot repeat or skip a collection; the feed still
 * de-duplicates by id, for the case where the catalog itself changed in between.
 */
export async function getCatalogPage(
  filters: FilterParams,
  offset = 0
): Promise<CatalogPage> {
  const start = Math.max(0, Math.trunc(offset));

  if (!isSupabaseConfigured) {
    const all = filterAndSortMedia(
      MOCK_MEDIA.filter((item) => item.published !== false),
      filters
    );
    const rows = all
      .slice(start, start + CATALOG_PAGE_SIZE)
      .map((item) => mockRow(item, filters.search));
    const page = pageFrom(rows, all.length, start, countByYear(all));
    return { ...page, items: await withViewerState(page.items) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_media", {
    p_type: filters.type,
    p_search: filters.search,
    p_genre: filters.genre,
    p_sort: filters.sort,
    p_year: filters.year === "all" ? null : Number(filters.year),
    p_month: filters.month === "all" ? null : Number(filters.month),
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_limit: CATALOG_PAGE_SIZE,
    p_offset: start,
  });

  if (error || !data) {
    // Loudly, and with an empty grid rather than the demo catalog: against a
    // configured project the usual cause is that supabase/schema.sql has not
    // been re-run since this function was added, and posters for titles that do
    // not exist would hide that instead of pointing at it.
    console.error(
      "getCatalogPage: search_media failed — re-run supabase/schema.sql. —",
      error?.message
    );
    return { items: [], total: 0, nextOffset: null, yearCounts: [] };
  }

  const result = data as SearchMediaResult;
  const page = pageFrom(result.items.map(mapRow), result.total, start, result.yearCounts);

  return { ...page, items: await withViewerState(page.items) };
}

/**
 * The genres and years the filter bar offers.
 *
 * Over the whole published catalog, not the current result: these are the
 * options, and a filter bar that only listed what the active filters already
 * left standing would be a dead end. Request-cached so the bar and anything
 * else that asks share one round trip.
 */
export const getCatalogFacets = cache(async function getCatalogFacets(): Promise<CatalogFacets> {
  if (!isSupabaseConfigured) {
    const published = MOCK_MEDIA.filter((item) => item.published !== false);
    return { genres: collectGenres(published), streamYears: collectStreamYears(published) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_facets");

  if (error || !data) {
    console.error("getCatalogFacets error —", error?.message);
    return { genres: [], streamYears: [] };
  }

  const result = data as { genres: GenreCount[]; years: number[] };

  return {
    // Ordered here rather than in SQL: Spanish collation is a client concern,
    // and it is a couple of dozen names.
    genres: [...result.genres].sort((a, b) => a.genre.localeCompare(b.genre, "es")),
    streamYears: result.years,
  };
});
