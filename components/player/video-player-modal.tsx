"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Monitor, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toOkRuEmbedUrl } from "@/lib/okru";
import { formatStreamDate, formatStreamRange } from "@/lib/stream-date";
import { cn } from "@/lib/utils";
import { isEpisodic, type Episode, type MediaItem } from "@/types/media";

/**
 * Preset player sizes. Each caps how much of the window height the picture may
 * take, and the modal is never wider than the 16:9 box that height allows —
 * otherwise a wide modal on a short screen would frame the video in black
 * bars. Only the `sm:` width is overridden so phones keep the default margin.
 */
const PLAYER_SIZES = {
  small: {
    label: "Pequeño",
    dialog: "sm:max-w-[min(48rem,calc(45vh*16/9))]",
    video: "max-h-[45vh] max-w-[calc(45vh*16/9)]",
  },
  medium: {
    label: "Mediano",
    dialog: "sm:max-w-[min(64rem,calc(58vh*16/9))]",
    video: "max-h-[58vh] max-w-[calc(58vh*16/9)]",
  },
  large: {
    label: "Grande",
    dialog: "sm:max-w-[min(80rem,calc(70vh*16/9))]",
    video: "max-h-[70vh] max-w-[calc(70vh*16/9)]",
  },
  full: {
    label: "Pantalla completa",
    dialog: "sm:max-w-[min(98vw,calc(80vh*16/9))]",
    video: "max-h-[80vh] max-w-[calc(80vh*16/9)]",
  },
} as const;

type PlayerSize = keyof typeof PLAYER_SIZES;

const SIZE_ORDER = Object.keys(PLAYER_SIZES) as PlayerSize[];
const DEFAULT_SIZE: PlayerSize = "medium";
/** Remembered across titles: picking a size is a viewing preference, not a per-video one. */
const SIZE_STORAGE_KEY = "novagiv:player-size";

function isPlayerSize(value: string | null): value is PlayerSize {
  return value !== null && value in PLAYER_SIZES;
}

/** Safe on the server, where the dialog's portal renders nothing anyway. */
function readStoredSize(): PlayerSize {
  if (typeof window === "undefined") return DEFAULT_SIZE;
  const stored = window.localStorage.getItem(SIZE_STORAGE_KEY);
  return isPlayerSize(stored) ? stored : DEFAULT_SIZE;
}

interface VideoPlayerModalProps {
  item: MediaItem | null;
  /** Query string to navigate back to when the modal is closed (removes `play`). */
  closeHref: string;
}

export function VideoPlayerModal({ item, closeHref }: VideoPlayerModalProps) {
  const router = useRouter();

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) router.push(closeHref || "?", { scroll: false });
      }}
    >
      {/* Keyed by item id so the episode selection resets on its own when a
          different title is opened, instead of syncing it via an effect. */}
      {item && <PlayerContent key={item.id} item={item} />}
    </Dialog>
  );
}

function PlayerContent({ item }: { item: MediaItem }) {
  const episodic = isEpisodic(item.type);
  const seasons = useMemo(() => groupBySeason(item.episodes ?? []), [item.episodes]);

  const [activeEpisodeId, setActiveEpisodeId] = useState<string | undefined>(
    seasons[0]?.episodes[0]?.id
  );

  const activeEpisode =
    (item.episodes ?? []).find((episode) => episode.id === activeEpisodeId) ?? item.episodes?.[0];
  const rawEmbedUrl = episodic ? activeEpisode?.okRuEmbedUrl : item.okRuEmbedUrl;
  const embedUrl = rawEmbedUrl ? toOkRuEmbedUrl(rawEmbedUrl) : undefined;
  const streamRange = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt);

  const [size, setSize] = useState<PlayerSize>(readStoredSize);

  function changeSize(next: PlayerSize) {
    setSize(next);
    window.localStorage.setItem(SIZE_STORAGE_KEY, next);
  }

  const sizePreset = PLAYER_SIZES[size];

  return (
    <DialogContent
      className={cn("gap-0 overflow-hidden p-0", sizePreset.dialog)}
      showCloseButton
    >
      {/* One column: the episode list sits under the video so the picture gets
          the full width of the modal instead of sharing it with a sidebar. */}
      <div className="flex max-h-[92vh] flex-col overflow-hidden">
        <div className="shrink-0 bg-black">
          <div className={cn("relative mx-auto aspect-video w-full", sizePreset.video)}>
            {embedUrl ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={
                  episodic && activeEpisode
                    ? `${item.title} · ${activeEpisode.title}`
                    : item.title
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

        <ScrollArea className="min-h-0 flex-1">
          <DialogHeader className="gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-lg">
                {item.title}
                {episodic && activeEpisode && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    · Episodio {activeEpisode.episodeNumber}: {activeEpisode.title}
                  </span>
                )}
              </DialogTitle>
              <PlayerSizeMenu size={size} onChange={changeSize} />
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
            </div>
            {item.description && (
              <DialogDescription className="text-sm">{item.description}</DialogDescription>
            )}
          </DialogHeader>

          {episodic && seasons.length > 0 && (
            // A container query, not a viewport one: how many episodes fit per
            // row depends on the size the viewer picked, not the window.
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
                  {/* Wide layouts fit several episodes per row, so the list
                      stays short even for a channel with 200 streams. */}
                  <div className="grid gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
                    {season.episodes.map((episode) => (
                      <button
                        key={episode.id}
                        type="button"
                        onClick={() => setActiveEpisodeId(episode.id)}
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
                        {episode.duration && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {episode.duration}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </DialogContent>
  );
}

/** Preset sizes for the picture, remembered for the next video. */
function PlayerSizeMenu({
  size,
  onChange,
}: {
  size: PlayerSize;
  onChange: (size: PlayerSize) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="shrink-0" aria-label="Tamaño del video" />
        }
      >
        <Monitor className="size-4" />
        <span className="hidden sm:inline">{PLAYER_SIZES[size].label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={size}
          onValueChange={(value) => onChange(value as PlayerSize)}
        >
          {SIZE_ORDER.map((option) => (
            // Radio items keep the menu open by default; picking a size is a
            // one-shot choice, so get out of the way of the video.
            <DropdownMenuRadioItem key={option} value={option} closeOnClick>
              {PLAYER_SIZES[option].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
