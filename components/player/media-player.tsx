"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  PlayCircle,
  Search,
} from "lucide-react";

import { LikeButton } from "@/components/player/like-button";
import { WatchLaterButton } from "@/components/player/watch-later-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { registerVideoView } from "@/lib/actions/views";
import { episodeParam } from "@/lib/episode-param";
import { filterEpisodes } from "@/lib/media-filter";
import { toOkRuEmbedUrl, withAutoplay } from "@/lib/okru";
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

/** Below this, the list is short enough to read at a glance. */
const EPISODE_SEARCH_THRESHOLD = 8;

/**
 * Counts the video on screen as viewed, once per video per browsing session.
 *
 * ok.ru's iframe never reports whether its video was actually played, so a view
 * here is "opened in the player". The sessionStorage guard is what keeps that
 * honest: flipping through episodes and coming back, or reopening a title while
 * browsing the catalog, adds nothing the second time. It also absorbs the
 * double run of this effect in development.
 *
 * For a signed-in visitor the same call also records where to pick the
 * collection up again (see `register_video_view` in supabase/schema.sql), which
 * is what feeds "Seguir viendo".
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

/**
 * Where an arrow key already means something: moving the caret in the episode
 * search, or picking an option in the size menu. Those keep it.
 */
const ARROW_KEY_OWNERS =
  'input, textarea, select, [contenteditable], [role="menu"], [role="listbox"], [role="radiogroup"], [role="slider"], [role="tablist"]';

/**
 * ←/→ step to the previous and next episode, the same as the buttons beside the
 * title.
 *
 * Listens on the window, not on the player, so it works wherever focus sits in
 * the dialog — except inside the ok.ru frame, whose keys belong to a
 * cross-origin document that never passes them on. There, the arrows seek the
 * video, which is what they should do anyway.
 *
 * In the capture phase, because the dialog's popup stops arrow keys from
 * bubbling past it (Base UI keeps them away from composite widgets outside the
 * dialog), so a bubbling listener up here would never hear one. That is also
 * why the checks below look at where the key was pressed rather than at
 * `defaultPrevented`: nothing inside has had its turn yet.
 */
function useEpisodeArrowKeys(
  previous: Episode | undefined,
  next: Episode | undefined,
  goTo: (episode: Episode) => void
) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // Alt+← is the browser's back, and the rest are text selection or
    // switching desktops: none of them is ours.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Holding the key down would otherwise race through the list, loading a
    // frame and counting a view for every episode it passes.
    if (event.repeat) return;
    if (event.target instanceof Element && event.target.closest(ARROW_KEY_OWNERS)) return;

    const target = event.key === "ArrowLeft" ? previous : next;
    if (!target) return;

    event.preventDefault();
    goTo(target);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);
}

interface MediaPlayerProps {
  item: MediaItem;
  /**
   * Videos of this collection the viewer has already liked. `null` means no
   * session, which is what makes the like button a link to the login form.
   */
  likedVideoIds: string[] | null;
  /** Videos of this collection on the viewer's "Ver después" list. `null` means no session. */
  savedVideoIds: string[] | null;
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
  savedVideoIds,
  initialEpisodeId,
  variant,
  headerActions,
  videoClassName,
}: MediaPlayerProps) {
  const episodic = isEpisodic(item.type);
  const seasons = useMemo(() => groupBySeason(item.episodes ?? []), [item.episodes]);

  // Autoplay is part of this state, not separate, because it describes *how*
  // the current episode was reached: picked by the viewer (play it), or the one
  // the URL opened on (wait for them).
  const [active, setActive] = useState<{ id?: string; autoplay: boolean }>({
    id: initialEpisodeId ?? seasons[0]?.episodes[0]?.id,
    autoplay: false,
  });
  const [episodeQuery, setEpisodeQuery] = useState("");

  const activeEpisode =
    (item.episodes ?? []).find((episode) => episode.id === active.id) ?? item.episodes?.[0];
  const rawEmbedUrl = episodic ? activeEpisode?.okRuEmbedUrl : item.okRuEmbedUrl;
  const baseEmbedUrl = rawEmbedUrl ? toOkRuEmbedUrl(rawEmbedUrl) : undefined;
  const embedUrl =
    baseEmbedUrl && active.autoplay ? withAutoplay(baseEmbedUrl) : baseEmbedUrl;
  const streamRange = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt);

  // Season order, then episode order: what "next" means to somebody watching.
  const orderedEpisodes = useMemo(
    () => seasons.flatMap((season) => season.episodes),
    [seasons]
  );
  const activeIndex = orderedEpisodes.findIndex((episode) => episode.id === activeEpisode?.id);
  const previousEpisode = activeIndex > 0 ? orderedEpisodes[activeIndex - 1] : undefined;
  const nextEpisode =
    activeIndex >= 0 && activeIndex < orderedEpisodes.length - 1
      ? orderedEpisodes[activeIndex + 1]
      : undefined;

  /**
   * Many channels carry one cover image repeated on every one of their videos,
   * so a thumbnail column would be the same picture two hundred times down the
   * page. It earns its place only where the pictures actually differ.
   */
  const showThumbnails = useMemo(() => {
    const urls = new Set(
      (item.episodes ?? []).map((episode) => episode.thumbnailUrl).filter(Boolean)
    );
    return urls.size > 1;
  }, [item.episodes]);

  const searchable = orderedEpisodes.length > EPISODE_SEARCH_THRESHOLD;
  const visibleSeasons = useMemo(() => {
    if (!episodeQuery.trim()) return seasons;

    return seasons
      .map((season) => ({ ...season, episodes: filterEpisodes(season.episodes, episodeQuery) }))
      .filter((season) => season.episodes.length > 0);
  }, [seasons, episodeQuery]);
  const visibleCount = visibleSeasons.reduce((total, season) => total + season.episodes.length, 0);

  // Keyed by episode for a series, by the collection itself for a movie —
  // exactly what the counters in the database are keyed by.
  const playingVideoId = baseEmbedUrl ? (episodic ? activeEpisode?.id : item.id) : undefined;
  useRegisterView(item.id, playingVideoId, episodic);

  const totalViews = totalViewsOf(item);
  const totalLikes = totalLikesOf(item);

  // The like belongs to the video on screen, not to the collection, so an
  // episodic title carries one per episode — the same keying as the counters.
  const playingLikes = (episodic ? activeEpisode?.likes : item.likes) ?? 0;
  const playingLiked = playingVideoId ? (likedVideoIds ?? []).includes(playingVideoId) : false;
  const playingSaved = playingVideoId ? (savedVideoIds ?? []).includes(playingVideoId) : false;

  function goToEpisode(episode: Episode) {
    setActive({ id: episode.id, autoplay: true });

    // `replaceState`, not a navigation: the episode is already on this page, so
    // re-rendering the route on the server would only move an iframe. Pushing
    // would be worse still — closing the player would then walk back through
    // every episode watched. Next.js patches this to keep the router in sync.
    const url = new URL(window.location.href);
    url.searchParams.set("ep", episodeParam(episode));
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  function selectEpisode(event: MouseEvent<HTMLAnchorElement>, episode: Episode) {
    // Anything but a plain left click is left to the browser, so ctrl/cmd-click
    // still opens that episode in its own tab — which is the point of these
    // being real links rather than buttons.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goToEpisode(episode);
  }

  useEpisodeArrowKeys(previousEpisode, nextEpisode, goToEpisode);

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
          <div className="flex shrink-0 items-center gap-1.5">
            {episodic && orderedEpisodes.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={!previousEpisode}
                  onClick={() => previousEpisode && goToEpisode(previousEpisode)}
                  aria-label="Episodio anterior"
                  aria-keyshortcuts="ArrowLeft"
                  title={
                    previousEpisode
                      ? `Anterior: ${previousEpisode.title} (←)`
                      : "Este es el primer episodio"
                  }
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={!nextEpisode}
                  onClick={() => nextEpisode && goToEpisode(nextEpisode)}
                  aria-label="Episodio siguiente"
                  aria-keyshortcuts="ArrowRight"
                  title={
                    nextEpisode
                      ? `Siguiente: ${nextEpisode.title} (→)`
                      : "Este es el último episodio"
                  }
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}

            {playingVideoId && (
              // Keyed by video: a new episode gets buttons that start from
              // that episode's own state, not the previous one's.
              <>
                <LikeButton
                  key={`like:${playingVideoId}`}
                  mediaItemId={item.id}
                  episodeId={episodic ? playingVideoId : undefined}
                  likes={playingLikes}
                  liked={playingLiked}
                  canLike={likedVideoIds !== null}
                />
                <WatchLaterButton
                  key={`later:${playingVideoId}`}
                  mediaItemId={item.id}
                  episodeId={episodic ? playingVideoId : undefined}
                  saved={playingSaved}
                  canSave={savedVideoIds !== null}
                />
              </>
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

        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
      </div>

      {episodic && seasons.length > 0 && (
        // A container query, not a viewport one: how many episodes fit per row
        // depends on the size the viewer picked, not on the window.
        <div className="@container flex flex-col gap-4 border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Episodios{" "}
              <span className="font-normal text-muted-foreground">
                {episodeQuery.trim()
                  ? `(${visibleCount} de ${orderedEpisodes.length})`
                  : `(${orderedEpisodes.length})`}
              </span>
            </p>

            {searchable && (
              <div className="relative w-full @md:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={episodeQuery}
                  onChange={(event) => setEpisodeQuery(event.target.value)}
                  placeholder="Buscar episodio o fecha…"
                  aria-label="Buscar dentro de los episodios"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            )}
          </div>

          {visibleCount === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ningún episodio coincide con «{episodeQuery.trim()}».
            </p>
          ) : (
            visibleSeasons.map((season) => (
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
                      aria-current={episode.id === activeEpisode?.id ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                        episode.id === activeEpisode?.id && "bg-primary/15 text-primary"
                      )}
                    >
                      {showThumbnails ? (
                        <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          {episode.thumbnailUrl ? (
                            <Image
                              src={episode.thumbnailUrl}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center">
                              <PlayCircle className="size-4 text-muted-foreground" />
                            </span>
                          )}
                        </span>
                      ) : (
                        <PlayCircle className="size-4 shrink-0" />
                      )}

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
            ))
          )}
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
