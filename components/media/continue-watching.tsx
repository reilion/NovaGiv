import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";

import { videoEntryHref, videoEntryKey } from "@/components/media/video-entry-list";
import { getWatchHistory } from "@/lib/queries";

/** Enough to be a shelf, few enough that it stays one swipe. */
const SHELF_LIMIT = 12;

/**
 * "Seguir viendo": the collections this account has open, each resuming at the
 * episode it was left on.
 *
 * Renders nothing at all for a visitor with no session or no history, so the
 * catalog stays exactly as it was for everybody else — which also means the
 * shelf never pushes the grid down on a phone until there is something in it.
 */
export async function ContinueWatching() {
  const history = await getWatchHistory();
  if (!history || history.length === 0) return null;

  const entries = history.slice(0, SHELF_LIMIT);

  return (
    <section className="flex flex-col gap-3 pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Seguir viendo</h2>
        <Link
          href="/historial"
          className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver historial
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {/* A row that scrolls sideways rather than a grid: this is a shortcut back
          into something, not a place to browse. */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {entries.map((entry) => (
          <Link
            key={videoEntryKey(entry)}
            href={videoEntryHref(entry)}
            className="group/resume flex w-28 shrink-0 flex-col gap-1.5 focus-visible:outline-none"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 transition-shadow group-hover/resume:shadow-glow group-focus-visible/resume:ring-2 group-focus-visible/resume:ring-ring">
              <Image
                src={entry.item.posterUrl}
                alt=""
                fill
                sizes="112px"
                className="object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/resume:bg-black/40 group-hover/resume:opacity-100">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Play className="size-4 fill-current" />
                </span>
              </span>
            </div>

            <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
              {entry.item.title}
            </p>
            {entry.episode && (
              <p className="truncate text-xs text-muted-foreground">
                Ep. {entry.episode.episodeNumber}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
