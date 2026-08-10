import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, Eye, Layers, Play } from "lucide-react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { formatStreamRange } from "@/lib/stream-date";
import { formatViews, formatViewsLabel } from "@/lib/text";
import { buildQueryString, type SearchParamsRecord } from "@/lib/url";
import { isEpisodic, MEDIA_STATUS_LABELS, totalViewsOf, type MediaItem } from "@/types/media";

interface MediaCardProps {
  item: MediaItem;
  currentParams: SearchParamsRecord;
}

/**
 * Single card used for every media type. Movies/specials/karaokes show a
 * duration badge and open the player directly; series/anime show an episode
 * count + status and open the same modal with the episode/season sidebar.
 * Clicking sets `?play=<slug>` in the URL — the server re-renders the page
 * with the modal already open, so no client state is needed here.
 */
export function MediaCard({ item, currentParams }: MediaCardProps) {
  const episodic = isEpisodic(item.type);
  const episodeCount = item.episodes?.length ?? 0;
  const href = `?${buildQueryString(currentParams, { play: item.slug })}`;
  const streamRange = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt);
  // Every video of the collection added up, so a series shows what it drew as a
  // whole and not just what its first episode did.
  const views = totalViewsOf(item);

  return (
    <Link
      href={href}
      scroll={false}
      className="group/card flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-glow focus-visible:-translate-y-1 focus-visible:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AspectRatio ratio={2 / 3} className="bg-muted">
        <Image
          src={item.posterUrl}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover transition-transform duration-300 group-hover/card:scale-105"
        />

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover/card:bg-black/40 group-hover/card:opacity-100 group-focus-visible/card:bg-black/40 group-focus-visible/card:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
            <Play className="size-5 fill-current" />
          </span>
        </div>

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {item.genres.slice(0, 2).map((genre) => (
            <Badge
              key={genre}
              variant="secondary"
              className="bg-black/60 text-[10px] text-foreground backdrop-blur-sm"
            >
              {genre}
            </Badge>
          ))}
        </div>

        {/* Hidden at zero: a catalog that has just gone live would otherwise
            show a "0" on every poster. */}
        {views > 0 && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-foreground backdrop-blur-sm"
            title={formatViewsLabel(views)}
          >
            <Eye className="size-3" />
            {formatViews(views)}
          </div>
        )}

        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-foreground backdrop-blur-sm">
          {episodic ? (
            <>
              <Layers className="size-3" />
              {episodeCount} ep.
            </>
          ) : (
            item.duration && (
              <>
                <Clock className="size-3" />
                {item.duration}
              </>
            )
          )}
        </div>
      </AspectRatio>

      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.year && <span>{item.year}</span>}
          {episodic && item.status && (
            <>
              {item.year && <span aria-hidden>·</span>}
              <span>{MEDIA_STATUS_LABELS[item.status]}</span>
            </>
          )}
        </div>
        {streamRange && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3 shrink-0" />
            <span className="truncate">{streamRange}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
