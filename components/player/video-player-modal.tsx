"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toOkRuEmbedUrl } from "@/lib/okru";
import { cn } from "@/lib/utils";
import { isEpisodic, type Episode, type MediaItem } from "@/types/media";

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

  return (
    <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl" showCloseButton>
      <div className="grid max-h-[85vh] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_320px]">
        <ScrollArea className="max-h-[85vh]">
          <div className="relative aspect-video w-full bg-black">
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

          <DialogHeader className="gap-2 p-4">
            <DialogTitle className="text-lg">
              {item.title}
              {episodic && activeEpisode && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · Episodio {activeEpisode.episodeNumber}: {activeEpisode.title}
                </span>
              )}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.genres.map((genre) => (
                <Badge key={genre} variant="outline">
                  {genre}
                </Badge>
              ))}
              {item.year && <Badge variant="secondary">{item.year}</Badge>}
            </div>
            {item.description && (
              <DialogDescription className="text-sm">{item.description}</DialogDescription>
            )}
          </DialogHeader>
        </ScrollArea>

        {episodic && seasons.length > 0 && (
          <div className="flex flex-col border-t border-border lg:border-l lg:border-t-0">
            <div className="px-4 py-3 text-sm font-medium text-foreground">Episodios</div>
            <ScrollArea className="h-64 lg:h-[calc(85vh-2.75rem)]">
              <div className="flex flex-col gap-4 px-4 pb-4">
                {seasons.map((season) => (
                  <div key={season.seasonNumber} className="flex flex-col gap-1.5">
                    {seasons.length > 1 && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Temporada {season.seasonNumber}
                      </p>
                    )}
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
                        <span className="flex-1 truncate">
                          {episode.episodeNumber}. {episode.title}
                        </span>
                        {episode.duration && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {episode.duration}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </DialogContent>
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
