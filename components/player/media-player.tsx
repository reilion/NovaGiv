"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { CalendarDays, Eye, Heart, PlayCircle } from "lucide-react";

import { LikeButton } from "@/components/player/like-button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { registerVideoView } from "@/lib/actions/views";
import { episodeParam } from "@/lib/episode-param";
import { toOkRuEmbedUrl } from "@/lib/okru";
import { formatStreamDate, formatStreamRange } from "@/lib/stream-date";
import { formatLikesLabel, formatViews, formatViewsLabel } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  isEpisodic,
  totalLikesOf,
  totalViewsOf,
  type Episode,
  type MediaItem,
} from "@/types/media";

/** One key per video already counted in this session — see `useRegisterView`. */
const VIEW_STORAGE_PREFIX = "novagiv:viewed:";

/** What the picture is capped at on the full page; the dialog passes its own. */
const PAGE_VIDEO_CLASS = "max-h-[75vh] max-w-[calc(75vh*16/9)]";

/**
 * Counts the video on screen as viewed, once per video per browsing session.
 *
 * ok.ru's iframe never reports whether its video was actually played, so a view
 * here is "opened in the player". The sessionStorage guard is what keeps that
 * honest: flipping through episodes and coming back, or reopening a title while
 * browsing the catalog, adds nothing the second time. It also absorbs the
 * double run of this effect in development.
 *
 * The numbers on screen come from the server render, so the view just counted
 * shows up on the next load of the catalog — nothing is bumped locally.
 */
function useRegisterView(mediaItemId: string, videoId: string | undefined, episodic: boolean) {
  useEffect(() => {
    if (!videoId) return;

    const storageKey = `${VIEW_STORAGE_PREFIX}${videoId}`;
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");

    // The collection's own video has no episode row to count on.
    void registerVideoView(mediaItemId, episodic ? videoId : undefined);
  }, [mediaItemId, videoId, episodic]);
}

interface MediaPlayerProps {
  item: MediaItem;
  /**
   * Videos of this collection the viewer has already liked. `null` means no
   * session, which is what makes the like button a link to the login form.
   */
  likedVideoIds: string[] | null;
  /** Whatever `?ep=` resolved to on the server; the first episode when absent. */
  initialEpisodeId?: string;
  /**
   * "modal" pins the picture and scrolls the rest inside the dialog; "page"
   * lets the document scroll, and titles the collection with an `h1`.
   */
  variant: "page" | "modal";
  /** Extra control beside the like button — the dialog's size menu. */
  headerActions?: ReactNode;
  /** Caps the picture. The dialog passes the size the viewer picked. */
  videoClassName?: string;
}

/**
 * The player itself: the ok.ru frame, what the collection is, and its episode
 * list. Shared by the /v/[slug] page and by the dialog that intercepts it from
 * the catalog, so both show exactly the same thing.
 */
export function MediaPlayer({
  item,
  likedVideoIds,
  initialEpisodeId,
  variant,
  headerActions,
  videoClassName,
}: MediaPlayerProps) {
  const episodic = isEpisodic(item.type);
  const seasons = useMemo(() => groupBySeason(item.episodes ?? []), [item.episodes]);

  const [activeEpisodeId, setActiveEpisodeId] = useState<string | undefined>(
    initialEpisodeId ?? seasons[0]?.episodes[0]?.id
  );

  const activeEpisode =
    (item.episodes ?? []).find((episode) => episode.id === activeEpisodeId) ?? item.episodes?.[0];
  const rawEmbedUrl = episodic ? activeEpisode?.okRuEmbedUrl : item.okRuEmbedUrl;
  const embedUrl = rawEmbedUrl ? toOkRuEmbedUrl(rawEmbedUrl) : undefined;
  const streamRange = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt);

  // Keyed by episode for a series, by the collection itself for a movie —
  // exactly what the counters in the database are keyed by.
  const playingVideoId = embedUrl ? (episodic ? activeEpisode?.id : item.id) : undefined;
  useRegisterView(item.id, playingVideoId, episodic);

  const totalViews = totalViewsOf(item);
  const totalLikes = totalLikesOf(item);

  // The like belongs to the video on screen, not to the collection, so an
  // episodic title carries one per episode — the same keying as the counters.
  const playingLikes = (episodic ? activeEpisode?.likes : item.likes) ?? 0;
  const playingLiked = playingVideoId ? (likedVideoIds ?? []).includes(playingVideoId) : false;

  function selectEpisode(event: MouseEvent<HTMLAnchorElement>, episode: Episode) {
    // Anything but a plain left click is left to the browser, so ctrl/cmd-click
    // still opens that episode in its own tab — which is the point of these
    // being real links rather than buttons.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    setActiveEpisodeId(episode.id);

    // `replaceState`, not a navigation: the episode is already on this page, so
    // re-rendering the route on the server would only move an iframe. Pushing
    // would be worse still — closing the player would then walk back through
    // every episode watched. Next.js patches this to keep the router in sync.
    const url = new URL(window.location.href);
    url.searchParams.set("ep", episodeParam(episode));
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  const Heading = variant === "page" ? "h1" : "h2";

  const video = (
    <div className="shrink-0 bg-black">
      <div
        className={cn(
          "relative mx-auto aspect-video w-full",
          videoClassName ?? (variant === "page" ? PAGE_VIDEO_CLASS : undefined)
        )}
      >
        {embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={
              episodic && activeEpisode ? `${item.title} · ${activeEpisode.title}` : item.title
            }
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Video no disponible.
          </div>
        )}
      </div>
    </div>
  );

  const details = (
    <>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Heading className="font-heading text-lg leading-tight font-medium text-foreground">
            {item.title}
            {episodic && activeEpisode && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · Episodio {activeEpisode.episodeNumber}: {activeEpisode.title}
              </span>
            )}
          </Heading>
          <div className="flex shrink-0 items-center gap-2">
            {playingVideoId && (
              // Keyed by video: a new episode gets a button that starts from
              // that episode's own like, not the previous one's.
              <LikeButton
                key={playingVideoId}
                mediaItemId={item.id}
                episodeId={episodic ? playingVideoId : undefined}
                likes={playingLikes}
                liked={playingLiked}
                canLike={likedVideoIds !== null}
              />
            )}
            {headerActions}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {item.genres.map((genre) => (
            <Badge key={genre} variant="outline">
              {genre}
            </Badge>
          ))}
          {item.year && <Badge variant="secondary">{item.year}</Badge>}
          {streamRange && (
            <Badge variant="secondary" className="gap-1">
              <CalendarDays className="size-3" />
              {streamRange}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="gap-1"
            title={episodic ? "Suma de las vistas de todos los episodios" : undefined}
          >
            <Eye className="size-3" />
            {formatViewsLabel(totalViews)}
          </Badge>
          {totalLikes > 0 && (
            <Badge
              variant="secondary"
              className="gap-1"
              title={episodic ? "Suma de los me gusta de todos los episodios" : undefined}
            >
              <Heart className="size-3" />
              {formatLikesLabel(totalLikes)}
            </Badge>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>

      {episodic && seasons.length > 0 && (
        // A container query, not a viewport one: how many episodes fit per row
        // depends on the size the viewer picked, not on the window.
        <div className="@container flex flex-col gap-4 border-t border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            Episodios{" "}
            <span className="font-normal text-muted-foreground">
              ({item.episodes?.length ?? 0})
            </span>
          </p>
          {seasons.map((season) => (
            <div key={season.seasonNumber} className="flex flex-col gap-1.5">
              {seasons.length > 1 && (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Temporada {season.seasonNumber}
                </p>
              )}
              {/* Wide layouts fit several episodes per row, so the list stays
                  short even for a channel with 200 streams. */}
              <div className="grid gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
                {season.episodes.map((episode) => (
                  <a
                    key={episode.id}
                    href={`?ep=${episodeParam(episode)}`}
                    onClick={(event) => selectEpisode(event, episode)}
                    aria-current={episode.id === activeEpisodeId ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                      episode.id === activeEpisodeId && "bg-primary/15 text-primary"
                    )}
                  >
                    <PlayCircle className="size-4 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">
                        {episode.episodeNumber}. {episode.title}
                      </span>
                      {episode.streamedAt && (
                        <span className="truncate text-xs text-muted-foreground">
                          {formatStreamDate(episode.streamedAt)}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="flex items-center gap-1"
                        title={formatViewsLabel(episode.views ?? 0)}
                      >
                        <Eye className="size-3" />
                        {formatViews(episode.views ?? 0)}
                      </span>
                      {(episode.likes ?? 0) > 0 && (
                        <span
                          className="flex items-center gap-1"
                          title={formatLikesLabel(episode.likes ?? 0)}
                        >
                          <Heart className="size-3" />
                          {formatViews(episode.likes ?? 0)}
                        </span>
                      )}
                      {episode.duration && <span>{episode.duration}</span>}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (variant === "modal") {
    // One column: the episode list sits under the video so the picture gets the
    // full width of the modal instead of sharing it with a sidebar.
    return (
      <div className="flex max-h-[92vh] flex-col overflow-hidden">
        {video}
        <ScrollArea className="min-h-0 flex-1">{details}</ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {video}
      {details}
    </div>
  );
}

function groupBySeason(episodes: Episode[]) {
  const bySeason = new Map<number, Episode[]>();

  [...episodes]
    .sort(
      (a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || a.episodeNumber - b.episodeNumber
    )
    .forEach((episode) => {
      const season = episode.seasonNumber ?? 1;
      if (!bySeason.has(season)) bySeason.set(season, []);
      bySeason.get(season)!.push(episode);
    });

  return Array.from(bySeason.entries())
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, seasonEpisodes]) => ({ seasonNumber, episodes: seasonEpisodes }));
}
