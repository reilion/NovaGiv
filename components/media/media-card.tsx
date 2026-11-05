import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Eye, Heart, Play, Search, Sparkles } from "lucide-react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { formatStreamRange } from "@/lib/stream-date";
import { formatLikesLabel, formatViews, formatViewsLabel } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  isEpisodic,
  MEDIA_STATUS_LABELS,
  MEDIA_TYPE_TAGS,
  type CatalogCard,
} from "@/types/media";

interface MediaCardProps {
  /**
   * One row of the catalog query. Everything the card draws is already on it —
   * the episode count, the view and like totals, which episodes the search
   * matched — so nothing here has to reach for a collection's episode list.
   */
  item: CatalogCard;
}

/**
 * Single card used for every media type. Movies/specials/karaokes show a
 * duration and open the player directly; series/anime show an episode count +
 * status and open the same player with its episode list.
 *
 * A plain link to the title's own page: from here that page is intercepted and
 * drawn as a dialog over the catalog (app/@modal), so the URL is shareable
 * while the catalog underneath keeps its filters and scroll position.
 */
export function MediaCard({ item }: MediaCardProps) {
  const episodic = isEpisodic(item.type);
  const { episodeCount, matchedEpisodes, views, likes, watched, isNew } = item;
  const matched = matchedEpisodes > 0;

  // A collection can be here because one of its streams matched, not its title.
  // Saying which, and opening straight at it, is the difference between finding
  // the night you were looking for and landing on a list of two hundred.
  const href = item.matchedEpisodeRef
    ? `/v/${item.slug}?ep=${item.matchedEpisodeRef}`
    : `/v/${item.slug}`;
  const streamRange = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt, { short: true });
  const genreLine = item.genres.slice(0, 2).join(" / ");

  const meta = [
    item.year,
    episodic && item.status ? MEDIA_STATUS_LABELS[item.status] : MEDIA_TYPE_TAGS[item.type],
  ].filter(Boolean);

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "group/card flex flex-col overflow-hidden rounded-xl bg-surface-low ring-1 ring-border transition-all duration-200 hover:-translate-y-1 hover:shadow-glow focus-visible:-translate-y-1 focus-visible:shadow-glow focus-visible:outline-none",
        matched && "ring-neon/50"
      )}
    >
      <AspectRatio ratio={2 / 3} className="overflow-hidden bg-surface">
        <Image
          src={item.posterUrl}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center bg-surface-lowest/0 opacity-0 transition-all duration-200 group-hover/card:bg-surface-lowest/40 group-hover/card:opacity-100 group-focus-visible/card:bg-surface-lowest/40 group-focus-visible/card:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
            <Play className="size-5 fill-current" />
          </span>
        </div>

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
          {genreLine ? (
            <span className="label-caps min-w-0 truncate rounded bg-surface-lowest/80 px-1.5 py-1 text-[10px] text-foreground backdrop-blur-md normal-case tracking-wide">
              {genreLine}
            </span>
          ) : (
            <span />
          )}

          {/* Same corner for all: a title already opened is not news any more,
              so "Visto" wins (the catalog never marks a watched title new). */}
          {watched ? (
            <span className="label-caps flex shrink-0 items-center gap-1 rounded bg-surface-lowest/80 px-1.5 py-1 text-[10px] text-muted-foreground backdrop-blur-md">
              <Check className="size-3" />
              Visto
            </span>
          ) : isNew ? (
            <span className="label-caps flex shrink-0 items-center gap-1 rounded bg-primary px-1.5 py-1 text-[10px] text-primary-foreground shadow-glow">
              <Sparkles className="size-3" />
              Nuevo
            </span>
          ) : matched ? (
            <span className="label-caps shrink-0 rounded bg-neon px-1.5 py-1 text-[10px] text-neon-foreground">
              Coincidencia
            </span>
          ) : null}
        </div>

        <div className="label-code absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 text-foreground">
          {/* Hidden at zero: a catalog that has just gone live would otherwise
              show a "0" on every poster. */}
          <span className="flex items-center gap-2">
            {likes > 0 && (
              <span className="flex items-center gap-1" title={formatLikesLabel(likes)}>
                <Heart className="size-3.5 fill-live text-live" />
                {formatViews(likes)}
              </span>
            )}
            {views !== undefined && views > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground" title={formatViewsLabel(views)}>
                <Eye className="size-3.5" />
                {formatViews(views)}
              </span>
            )}
          </span>
          <span className="shrink-0 font-semibold">
            {episodic ? `${episodeCount} ep.` : item.duration}
          </span>
        </div>
      </AspectRatio>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {item.title}
        </h3>
        {meta.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" • ")}</p>
        )}

        {matched && (
          <p className="label-code mt-2 flex items-center gap-1 text-neon">
            <Search className="size-3 shrink-0" />
            <span className="truncate">
              {matchedEpisodes === 1 ? "1 episodio coincide" : `${matchedEpisodes} episodios coinciden`}
            </span>
          </p>
        )}

        {streamRange && (
          <div className="mt-auto pt-2">
            <p className="label-code flex items-start gap-1.5 border-t border-border pt-2 text-primary">
              <CalendarDays className="mt-px size-3.5 shrink-0" />
              <span className="line-clamp-2">Stream: {streamRange}</span>
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
