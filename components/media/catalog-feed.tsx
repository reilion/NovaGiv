"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { EmptyState, MediaGrid, MediaGridByYear } from "@/components/media/media-grid";
import { Button } from "@/components/ui/button";
import { loadCatalogPage } from "@/lib/actions/catalog";
import { groupByStreamYear } from "@/lib/media-filter";
import type { CatalogCard, CatalogPage } from "@/types/media";

interface CatalogFeedProps {
  /** The page the server already rendered — the grid starts filled. */
  initial: CatalogPage;
  /** The filters this result was produced with, as the address bar carries them. */
  query: string;
  /** Whether the grid is split into year sections. */
  grouped: boolean;
  /** Oldest-first, which reverses the order of those sections. */
  ascending: boolean;
}

/**
 * The catalog grid, filled one page at a time.
 *
 * The first page is server-rendered, so what a visitor sees first costs exactly
 * one query and no client JavaScript has to run for it. Everything after it is
 * asked for a screen ahead of being needed, which is the whole point: a channel
 * with hundreds of streams is browsed a few rows at a time, and loading it whole
 * was paying for all of it to show two.
 *
 * Changing a filter is a navigation, not a state update here: the page re-keys
 * this component on the query string, so a new result always starts from a
 * freshly rendered first page rather than from whatever the previous scroll had
 * accumulated.
 */
export function CatalogFeed({ initial, query, grouped, ascending }: CatalogFeedProps) {
  const [items, setItems] = useState<CatalogCard[]>(initial.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const sentinel = useRef<HTMLDivElement>(null);
  // A ref as well as the state above: two intersections can arrive before React
  // has re-rendered, and only this stops the second from asking for the same page.
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlight.current || nextOffset === null) return;

    inFlight.current = true;
    setIsLoading(true);
    setFailed(false);

    try {
      const page = await loadCatalogPage(query, nextOffset);

      setItems((current) => {
        // The catalog can change between two pages — a new import, a title
        // unpublished — and either shifts every offset after it. Dropping ids
        // already on screen is cheaper than a cursor, and a duplicated key is
        // the one failure a visitor would actually notice.
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextOffset(page.nextOffset);
    } catch {
      // Left for the button below to retry: an automatic one would just fail
      // again, and the observer does not fire twice without a scroll anyway.
      setFailed(true);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [query, nextOffset]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || nextOffset === null || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      // A screen ahead, so the next rows are usually there before the last ones
      // are read. Re-observing after each page also covers a viewport tall
      // enough to show more than one at a time.
      { rootMargin: "800px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, nextOffset, failed]);

  if (items.length === 0) return <EmptyState />;

  const counts = new Map(initial.yearCounts.map(({ year, count }) => [year, count]));

  return (
    <>
      {grouped ? (
        <MediaGridByYear groups={groupByStreamYear(items, ascending)} counts={counts} />
      ) : (
        <MediaGrid items={items} />
      )}

      <div
        ref={sentinel}
        className="flex flex-col items-center justify-center gap-3 pb-10 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {failed ? (
          <>
            <p>No se pudieron cargar más colecciones.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadMore()}>
              Reintentar
            </Button>
          </>
        ) : nextOffset !== null ? (
          <>
            {isLoading && <Loader2 className="size-5 animate-spin text-primary" />}
            {/* Also the way in without an IntersectionObserver, and the way out
                for anybody who would rather click than keep scrolling. */}
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadMore()}>
              Cargar más
            </Button>
            <p>
              {items.length} de {initial.total}
            </p>
          </>
        ) : (
          initial.total > 0 && (
            <p>
              {initial.total} {initial.total === 1 ? "colección" : "colecciones"} en total.
            </p>
          )
        )}
      </div>
    </>
  );
}
