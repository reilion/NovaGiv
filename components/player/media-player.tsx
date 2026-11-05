"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  Eye,
  Heart,
  Link2,
  ListVideo,
  Play,
  PlayCircle,
  Search,
  Share2,
  Star,
} from "lucide-react";

import { GuestSyncBanner } from "@/components/auth/guest-sync-banner";
import { LikeButton } from "@/components/player/like-button";
import { WatchLaterButton } from "@/components/player/watch-later-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerVideoView } from "@/lib/actions/views";
import { episodeParam } from "@/lib/episode-param";
import { filterEpisodes } from "@/lib/media-filter";
import { toOkRuEmbedUrl, withAutoplay } from "@/lib/okru";
import { formatStreamDate, formatStreamRange } from "@/lib/stream-date";
import { formatLikesLabel, formatViews, formatViewsLabel } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  isEpisodic,
  MEDIA_STATUS_LABELS,
  MEDIA_TYPE_TAGS,
  totalLikesOf,
  totalViewsOf,
  type Episode,
  type MediaItem,
} from "@/types/media";

/** One key per video already counted in this session — see `useRegisterView`. */
const VIEW_STORAGE_PREFIX = "novagiv:viewed:";

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
  /** Extra control beside the like button — the size menu. */
  headerActions?: ReactNode;
  /** Caps the picture: the size the viewer picked — see player-size.tsx. */
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
  const [seasonTab, setSeasonTab] = useState<number | null>(null);
  // Phones show two lines of the synopsis until asked for the rest.
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const episodeListRef = useRef<HTMLDivElement>(null);

  const activeEpisode =
    (item.episodes ?? []).find((episode) => episode.id === active.id) ?? item.episodes?.[0];

  // Keep the playing episode visible in the list's own scroll box, on the page
  // and in the dialog alike. Moving that scrollTop by hand, not
  // `scrollIntoView`, so nothing around it jumps along.
  useEffect(() => {
    const list = episodeListRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !current) return;

    const scroller = list;

    const scrollerBox = scroller.getBoundingClientRect();
    const itemBox = current.getBoundingClientRect();
    if (itemBox.top < scrollerBox.top) {
      scroller.scrollTop += itemBox.top - scrollerBox.top;
    } else if (itemBox.bottom > scrollerBox.bottom) {
      scroller.scrollTop += itemBox.bottom - scrollerBox.bottom;
    }
  }, [activeEpisode?.id, seasonTab]);

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
    // Back to following the playing episode, whichever season it is in.
    setSeasonTab(null);

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

  // The season the list shows: the one picked in its tabs, else the one the
  // playing episode belongs to — so stepping into the next season follows along.
  const shownSeason = seasonTab ?? activeEpisode?.seasonNumber ?? seasons[0]?.seasonNumber ?? 1;
  const searching = episodeQuery.trim() !== "";
  const listedSeasons =
    searching || seasons.length < 2
      ? visibleSeasons
      : visibleSeasons.filter((season) => season.seasonNumber === shownSeason);
  const playingStreamedAt = episodic ? activeEpisode?.streamedAt : item.firstStreamedAt;

  const video = (
    <div
      className={cn(
        "shrink-0 bg-[#040406]",
        variant === "page" &&
          // Edge to edge on phones, like any video app; framed from `sm` up.
          "-mx-4 overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8),0_0_16px_-2px_rgba(208,188,255,0.2)] sm:mx-0 sm:rounded-xl sm:ring-1 sm:ring-border"
      )}
    >
      <div className={cn("relative mx-auto aspect-video w-full", videoClassName)}>
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

  const actionBar = (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 bg-surface-low p-2 sm:gap-3 sm:p-3 sm:px-4",
        variant === "page" ? "mt-3 rounded-xl ring-1 ring-border" : "border-b border-border"
      )}
    >
      {/* Phones move the date into the details below, so prev/next and the
          actions share one row. */}
      <div className="hidden min-w-0 flex-wrap items-center gap-2 sm:flex">
        {playingStreamedAt && (
          <span className="label-code flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-foreground">
            <CalendarDays className="size-3.5 text-primary" />
            Transmitido el {formatStreamDate(playingStreamedAt)}
          </span>
        )}
        {episodic && activeEpisode && (
          <span className="label-caps rounded-lg bg-neon/15 px-2.5 py-1.5 text-neon">
            {seasons.length > 1 && `T${activeEpisode.seasonNumber ?? 1} · `}Ep.{" "}
            {activeEpisode.episodeNumber}
            {orderedEpisodes.length > 0 && ` / ${orderedEpisodes.length}`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {episodic && orderedEpisodes.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg bg-surface p-0.5 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!previousEpisode}
              onClick={() => previousEpisode && goToEpisode(previousEpisode)}
              aria-label="Episodio anterior"
              aria-keyshortcuts="ArrowLeft"
              title={
                previousEpisode
                  ? `Anterior: ${previousEpisode.title} (←)`
                  : "Este es el primer episodio"
              }
              className="label-code"
            >
              <ChevronLeft className="size-4" />
              {previousEpisode && <span>Ep. {previousEpisode.episodeNumber}</span>}
            </Button>
            <span className="hidden h-4 w-px bg-outline-variant sm:block" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!nextEpisode}
              onClick={() => nextEpisode && goToEpisode(nextEpisode)}
              aria-label="Episodio siguiente"
              aria-keyshortcuts="ArrowRight"
              title={
                nextEpisode ? `Siguiente: ${nextEpisode.title} (→)` : "Este es el último episodio"
              }
              // Phones: the step forward is the one the thumb is after.
              className={cn(
                "label-code",
                nextEpisode &&
                  "max-sm:bg-primary max-sm:text-primary-foreground max-sm:hover:bg-primary/90"
              )}
            >
              {nextEpisode && <span>Ep. {nextEpisode.episodeNumber}</span>}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {playingVideoId && (
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
        <ShareButton title={item.title} />
        {/* The size presets only mean something on a wide screen. */}
        {headerActions && <span className="hidden sm:contents">{headerActions}</span>}
      </div>
    </div>
  );

  const details = (
    <section
      className={cn(
        "flex flex-col gap-4 bg-surface-low p-4 sm:gap-5 sm:p-6",
        variant === "page" &&
          "-mx-4 bg-transparent sm:mx-0 sm:rounded-xl sm:bg-surface-low sm:ring-1 sm:ring-border"
      )}
    >
      <div className="flex gap-5">
        <div className="relative hidden aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-lg bg-surface ring-1 ring-border @lg:block @3xl:w-40">
          <Image src={item.posterUrl} alt="" fill sizes="160px" className="object-cover" />
          {item.rating !== undefined && (
            <span className="label-code absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/90 to-transparent pb-2 pt-6 text-foreground">
              <Star className="size-3 fill-primary text-primary" />
              {item.rating} / 10
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {playingStreamedAt && (
            <p className="label-code flex items-center gap-1.5 text-foreground sm:hidden">
              <CalendarDays className="size-3.5 text-primary" />
              Transmitido: {formatStreamDate(playingStreamedAt)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps rounded bg-primary px-1.5 py-0.5 text-primary-foreground">
              {MEDIA_TYPE_TAGS[item.type]}
            </span>
            {item.genres.map((genre) => (
              <span
                key={genre}
                className="label-caps rounded bg-surface-high px-1.5 py-0.5 text-foreground"
              >
                {genre}
              </span>
            ))}
            {episodic && item.status && (
              <span className="label-code px-1 text-neon">
                {MEDIA_STATUS_LABELS[item.status]}
                {orderedEpisodes.length > 0 && ` (${orderedEpisodes.length} ep.)`}
              </span>
            )}
          </div>

          <div>
            <Heading className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl sm:font-bold">
              {item.title}
            </Heading>
            {episodic && activeEpisode && (
              <p className="mt-1 text-base font-medium text-primary">
                Episodio {activeEpisode.episodeNumber}: {activeEpisode.title}
              </p>
            )}
          </div>

          <div className="grid gap-2 @md:grid-cols-2">
            {streamRange && (
              <InfoTile icon={<CalendarDays className="size-4 text-primary" />}>
                {streamRange}
              </InfoTile>
            )}
            {item.year && (
              <InfoTile icon={<Clapperboard className="size-4 text-primary" />}>
                Año {item.year}
                {item.duration && !episodic && ` · ${item.duration}`}
              </InfoTile>
            )}
            {totalLikes > 0 && (
              <InfoTile
                icon={<Heart className="size-4 fill-live text-live" />}
                title={episodic ? "Suma de los me gusta de todos los episodios" : undefined}
              >
                {formatLikesLabel(totalLikes)}
              </InfoTile>
            )}
            {/* Undefined for everybody but an admin while the counters are
                not public — see VIEW_COUNTS_ADMIN_ONLY. */}
            {totalViews !== undefined && (
              <InfoTile
                icon={<Eye className="size-4 text-muted-foreground" />}
                title={episodic ? "Suma de las vistas de todos los episodios" : undefined}
              >
                {formatViewsLabel(totalViews)} <span className="text-outline">(solo admin)</span>
              </InfoTile>
            )}
          </div>
        </div>
      </div>

      {item.description && (
        <div className="flex flex-col gap-1.5">
          <p className="label-caps text-outline">Sinopsis</p>
          <p
            className={cn(
              "text-sm leading-relaxed text-foreground/90 sm:line-clamp-none sm:text-base",
              !synopsisOpen && "line-clamp-2"
            )}
          >
            {item.description}
          </p>
          <button
            type="button"
            onClick={() => setSynopsisOpen((open) => !open)}
            aria-expanded={synopsisOpen}
            className="flex w-fit items-center gap-1 text-sm font-medium text-primary sm:hidden"
          >
            {synopsisOpen ? "Leer menos" : "Leer más…"}
            <ChevronDown className={cn("size-4 transition-transform", synopsisOpen && "rotate-180")} />
          </button>
        </div>
      )}

      {item.okruChannelUrl && (
        <a
          href={item.okruChannelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-high"
        >
          <Link2 className="size-4" />
          Fuente:
          <span className="font-semibold text-neon">
            {item.okruChannelName ? `Canal ${item.okruChannelName}` : "Canal de ok.ru"}
          </span>
          <ExternalLink className="size-3.5" />
        </a>
      )}

      {/* No session: nothing watched here is kept. Said where it is felt. */}
      {likedVideoIds === null && (
        <GuestSyncBanner
          className="md:hidden"
          title="¿Guardar tu progreso?"
          description="Inicia sesión para sincronizar tu historial."
          href={`/login?next=${encodeURIComponent(`/v/${item.slug}`)}`}
          cta="Acceder"
        />
      )}
    </section>
  );

  const episodesPanel = episodic && seasons.length > 0 && (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 bg-surface-low p-4",
        variant === "page"
          ? "-mx-4 bg-transparent sm:mx-0 sm:rounded-xl sm:bg-surface-low sm:ring-1 sm:ring-border"
          : "border-t border-border @4xl:border-l @4xl:border-t-0"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-lg sm:font-bold">
          <ListVideo className="hidden size-5 text-primary sm:block" />
          Episodios
          <span className="label-code rounded bg-surface-high px-1.5 py-0.5 text-muted-foreground">
            {searching ? `${visibleCount} de ${orderedEpisodes.length}` : orderedEpisodes.length}
          </span>
        </h3>

        {seasons.length > 1 && !searching && (
          <div
            className="scrollbar-none -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:gap-1 sm:rounded-lg sm:bg-surface sm:p-0.5"
            role="group"
            aria-label="Temporada"
          >
            {seasons.map((season) => (
              <button
                key={season.seasonNumber}
                type="button"
                aria-pressed={season.seasonNumber === shownSeason}
                onClick={() => setSeasonTab(season.seasonNumber)}
                className={cn(
                  "shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:px-2 sm:py-1",
                  season.seasonNumber === shownSeason
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-high text-foreground sm:bg-transparent sm:text-muted-foreground sm:hover:text-foreground"
                )}
              >
                <span className="sm:hidden">
                  Temporada {season.seasonNumber} ({season.episodes.length} eps)
                </span>
                <span className="label-code hidden sm:inline">
                  T{season.seasonNumber} ({season.episodes.length})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {searchable && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-outline" />
          <Input
            value={episodeQuery}
            onChange={(event) => setEpisodeQuery(event.target.value)}
            placeholder="Buscar episodio por número, título o fecha…"
            aria-label="Buscar dentro de los episodios"
            className="h-10 border-transparent bg-surface pl-9 text-sm dark:bg-surface sm:h-9"
          />
        </div>
      )}

      {visibleCount === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ningún episodio coincide con «{episodeQuery.trim()}».
        </p>
      ) : (
        <div
          ref={episodeListRef}
          className={cn(
            "scrollbar-thin -mr-2 flex flex-col gap-4 overflow-y-auto pr-2",
            // Phones scroll the page itself: a box inside a scrolling page is
            // a trap for the thumb.
            variant === "page" ? "sm:max-h-[40rem]" : "sm:max-h-[28rem]"
          )}
        >
          {listedSeasons.map((season) => (
            <div key={season.seasonNumber} className="flex flex-col gap-1.5">
              {seasons.length > 1 && searching && (
                <p className="label-caps text-outline">Temporada {season.seasonNumber}</p>
              )}
              {season.episodes.map((episode) => {
                const current = episode.id === activeEpisode?.id;

                return (
                  <a
                    key={episode.id}
                    href={`?ep=${episodeParam(episode)}`}
                    onClick={(event) => selectEpisode(event, episode)}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "group/ep relative flex items-center gap-3 rounded-xl p-2 text-left transition-colors sm:rounded-lg",
                      current
                        ? "bg-surface-high shadow-[0_0_24px_-8px_rgba(208,188,255,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-lg before:bg-primary sm:shadow-none"
                        : "bg-surface/60 hover:bg-surface-high"
                    )}
                  >
                    {showThumbnails ? (
                      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-surface-highest sm:w-24">
                        {episode.thumbnailUrl ? (
                          <Image
                            src={episode.thumbnailUrl}
                            alt=""
                            fill
                            sizes="128px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center">
                            <PlayCircle className="size-5 text-muted-foreground" />
                          </span>
                        )}
                        {episode.duration && (
                          <span className="label-code absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] text-foreground">
                            {episode.duration}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "label-code flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-highest text-muted-foreground",
                          current && "bg-primary text-primary-foreground"
                        )}
                      >
                        {current ? <Play className="size-4 fill-current" /> : episode.episodeNumber}
                      </span>
                    )}

                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {current && (
                            <span className="label-caps shrink-0 rounded bg-primary px-1 py-px text-[9px] text-primary-foreground">
                              En curso
                            </span>
                          )}
                          <span className="label-caps truncate text-outline">
                            Episodio {episode.episodeNumber}
                          </span>
                        </span>
                        {episode.streamedAt && (
                          <span className="label-code shrink-0 text-[11px] text-outline">
                            {formatStreamDate(episode.streamedAt)}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "truncate text-base font-medium text-foreground sm:text-sm",
                          current && "text-primary"
                        )}
                      >
                        {episode.title}
                      </span>
                      <span className="label-code flex items-center gap-3 text-[11px] text-muted-foreground">
                        {(episode.likes ?? 0) > 0 && (
                          <span className="flex items-center gap-1" title={formatLikesLabel(episode.likes ?? 0)}>
                            <Heart className="size-3 fill-live text-live" />
                            {formatViews(episode.likes ?? 0)}
                          </span>
                        )}
                        {episode.views !== undefined && (
                          <span className="flex items-center gap-1" title={formatViewsLabel(episode.views)}>
                            <Eye className="size-3" />
                            {formatViews(episode.views)}
                          </span>
                        )}
                        {!showThumbnails && episode.duration && <span>{episode.duration}</span>}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const body = (
    <div
      className={cn(
        "@container",
        variant === "page" && "mt-2 sm:mt-6"
      )}
    >
      <div
        className={cn(
          "grid",
          episodesPanel && "@4xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]",
          variant === "page" && "gap-6"
        )}
      >
        {details}
        {episodesPanel}
      </div>
    </div>
  );

  if (variant === "modal") {
    // The picture stays pinned while the rest scrolls under it. A plain
    // overflow box, not ScrollArea: its viewport is `height: 100%`, which never
    // resolves against a parent capped only by max-height, so it grew to fit
    // everything and the bottom of the list was clipped away.
    return (
      <div className="flex max-h-[92vh] flex-col overflow-hidden bg-surface-low max-sm:h-dvh max-sm:max-h-dvh">
        {video}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {actionBar}
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {video}
      {actionBar}
      {body}
    </div>
  );
}

function InfoTile({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="label-code flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-foreground"
      title={title}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Shares the title's URL — the episode included, since it lives in `?ep=`. */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dismissed share sheet or blocked clipboard: nothing to report.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void share()}
      aria-label="Compartir"
      title={copied ? "Enlace copiado" : "Compartir enlace"}
      className="shrink-0"
    >
      {copied ? <Check className="size-4 text-primary" /> : <Share2 className="size-4" />}
      <span className="hidden sm:inline">{copied ? "Copiado" : "Compartir"}</span>
    </Button>
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
