"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listChannelSiblings,
  type ChannelSibling,
  type ChannelSiblingEpisode,
} from "@/lib/actions/channel-collections";
import { formatStreamDate } from "@/lib/stream-date";
import { cn } from "@/lib/utils";
import { MEDIA_TYPE_LABELS } from "@/types/media";

interface ChannelEpisodePickerProps {
  mediaItemId: string;
  /** Taken from the form, so a channel linked but not saved yet still works. */
  channelId: string;
  /** Episode ids already taken into the form, so they can't be added twice. */
  claimedEpisodeIds: string[];
  onAdd: (episodes: ChannelSiblingEpisode[]) => void;
  onClose: () => void;
}

/**
 * Pulls videos from the other collections built out of the same ok.ru channel.
 * Picking here only stages the move: the episodes are removed from their
 * current collection when this form is saved.
 */
export function ChannelEpisodePicker({
  mediaItemId,
  channelId,
  claimedEpisodeIds,
  onAdd,
  onClose,
}: ChannelEpisodePickerProps) {
  const [collections, setCollections] = useState<ChannelSibling[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, ChannelSiblingEpisode>>({});
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const result = await listChannelSiblings(mediaItemId, channelId);
      if (result.error) setError(result.error);
      else setCollections(result.collections ?? []);
    });
  }, [mediaItemId, channelId]);

  const claimed = new Set(claimedEpisodeIds);
  const selectedList = Object.values(selected);

  function toggle(episode: ChannelSiblingEpisode) {
    setSelected((current) => {
      const next = { ...current };
      if (next[episode.id]) delete next[episode.id];
      else next[episode.id] = episode;
      return next;
    });
  }

  function toggleCollection(collection: ChannelSibling) {
    const selectable = collection.episodes.filter((episode) => !claimed.has(episode.id));
    const allSelected = selectable.every((episode) => selected[episode.id]);
    setSelected((current) => {
      const next = { ...current };
      for (const episode of selectable) {
        if (allSelected) delete next[episode.id];
        else next[episode.id] = episode;
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Episodios de las otras colecciones de este canal. Los que elijas se moverán aquí
          al guardar.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando colecciones…
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {collections && collections.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          Este canal todavía no tiene otras colecciones con episodios.
        </p>
      )}

      {collections && collections.length > 0 && (
        <div className="flex max-h-96 flex-col gap-4 overflow-y-auto">
          {collections.map((collection) => (
            <div key={collection.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{collection.title}</span>
                <Badge variant="outline">{MEDIA_TYPE_LABELS[collection.type]}</Badge>
                {collection.isPrimary && <Badge variant="secondary">Principal del canal</Badge>}
                {!collection.published && <Badge variant="outline">Borrador</Badge>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCollection(collection)}
                >
                  Marcar todos
                </Button>
              </div>

              <div className="flex flex-col gap-1">
                {collection.episodes.map((episode) => {
                  const alreadyTaken = claimed.has(episode.id);
                  const isSelected = Boolean(selected[episode.id]);
                  return (
                    <button
                      key={episode.id}
                      type="button"
                      disabled={alreadyTaken}
                      onClick={() => toggle(episode)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                        alreadyTaken
                          ? "cursor-not-allowed border-dashed border-border text-muted-foreground"
                          : "border-border hover:border-primary",
                        isSelected && "border-primary bg-primary/10"
                      )}
                    >
                      <span className="truncate">
                        <span className="text-muted-foreground">
                          {episode.seasonNumber ? `T${episode.seasonNumber}·` : ""}
                          {episode.episodeNumber}.
                        </span>{" "}
                        {episode.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {alreadyTaken
                          ? "ya añadido"
                          : [formatStreamDate(episode.streamedAt), episode.duration]
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedList.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">
            {selectedList.length} episodio{selectedList.length === 1 ? "" : "s"} seleccionado
            {selectedList.length === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            onClick={() => {
              onAdd(selectedList);
              setSelected({});
            }}
          >
            Añadir a esta colección
          </Button>
        </div>
      )}
    </div>
  );
}
