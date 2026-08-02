"use client";

/* eslint-disable @next/next/no-img-element -- admin-only preview of remote ok.ru thumbnails, no next/image needed here */

import { useMemo, useState, useTransition } from "react";
import { Link2, Link2Off, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listLinkableOkRuChannels,
  type LinkableOkRuChannel,
} from "@/lib/actions/okru-import";
import { normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { OkRuChannelRef } from "@/types/media";

interface OkRuChannelPickerProps {
  /** The channel currently linked (or just picked and not saved yet). */
  value: OkRuChannelRef | null;
  onChange: (channel: OkRuChannelRef | null) => void;
  /** The stored link, so the picker can tell "already saved" from "pending save". */
  savedChannelId?: string;
  /** True when this is the collection the sync appends the channel's new videos to. */
  isPrimary?: boolean;
}

/**
 * Shows which ok.ru channel a collection came from, and lets the admin attach
 * one when the link is missing (collections imported before the channel id was
 * stored, or created by hand). The link — not the title — is what
 * `pnpm okru:sync` matches on, so it must survive renaming the collection.
 */
export function OkRuChannelPicker({
  value,
  onChange,
  savedChannelId,
  isPrimary,
}: OkRuChannelPickerProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [channels, setChannels] = useState<LinkableOkRuChannel[] | null>(null);
  const [source, setSource] = useState<"db" | "live" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, startLoading] = useTransition();

  const results = useMemo(() => {
    if (!channels) return [];
    const needle = normalizeSearch(query.trim());
    if (!needle) return channels;
    return channels.filter(
      (channel) =>
        normalizeSearch(channel.name).includes(needle) || channel.id.includes(needle)
    );
  }, [channels, query]);

  function openSearch() {
    setIsSearching(true);
    if (channels) return;

    setError(null);
    startLoading(async () => {
      const result = await listLinkableOkRuChannels();
      if (result.error) setError(result.error);
      else {
        setChannels(result.channels ?? []);
        setSource(result.source ?? null);
      }
    });
  }

  function selectChannel(channel: LinkableOkRuChannel) {
    onChange({ id: channel.id, name: channel.name, url: channel.url });
    setIsSearching(false);
    setQuery("");
  }

  const isPending = Boolean(value) && value?.id !== savedChannelId;

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{value.name}</span>
              <Badge variant="outline">{value.id}</Badge>
              {isPrimary && <Badge>Principal del canal</Badge>}
              {isPending && <Badge variant="secondary">Sin guardar</Badge>}
            </div>
            <span className="text-xs text-muted-foreground">
              Nombre original del canal en ok.ru.{" "}
              {isPrimary
                ? "Aunque renombres esta colección, la próxima sincronización seguirá reconociéndola por este canal y solo añadirá los videos nuevos."
                : "Esta colección salió de ese canal, pero los videos nuevos van a la colección principal del canal."}
            </span>
            {value.url && (
              <a
                href={value.url}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-xs text-primary underline-offset-4 hover:underline"
              >
                Ver canal en ok.ru
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openSearch}>
              <Link2 className="size-4" />
              Cambiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setIsSearching(false);
              }}
            >
              <Link2Off className="size-4" />
              Desvincular
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
          <span className="text-sm text-muted-foreground">
            Esta colección no está vinculada a ningún canal de ok.ru, así que{" "}
            <code>pnpm okru:sync</code> no sabe cuál es y podría crearla otra vez como
            duplicada. Búscala entre los canales importados para relacionarla.
          </span>
          {!isSearching && (
            <Button type="button" variant="outline" size="sm" onClick={openSearch}>
              <Search className="size-4" />
              Buscar canal
            </Button>
          )}
        </div>
      )}

      {isSearching && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o id de canal…"
              className="flex-1"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSearching(false)}
            >
              Cerrar
            </Button>
          </div>

          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando canales…
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {source === "live" && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Todavía no hay canales guardados en la base de datos, así que esta lista se
              leyó en vivo de ok.ru y llega hasta 20 canales. Ejecuta{" "}
              <code>pnpm okru:sync</code> para guardarlos todos.
            </p>
          )}

          {channels && channels.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">
              No hay canales para elegir. Ejecuta <code>pnpm okru:sync</code> para traerlos.
            </p>
          )}

          {channels && channels.length > 0 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ningún canal coincide con &ldquo;{query}&rdquo;.
            </p>
          )}

          {results.length > 0 && (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {results.map((channel) => {
                // A channel can back several collections (a movie split out of
                // it, for instance), so being in use doesn't block linking —
                // it just means this one won't be the collection the sync
                // appends new videos to.
                const usedElsewhere = Boolean(channel.linkedTo) && channel.id !== value?.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => selectChannel(channel)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:border-primary",
                      channel.id === value?.id && "border-primary bg-primary/10"
                    )}
                  >
                    {channel.thumbnailUrl ? (
                      <img
                        src={channel.thumbnailUrl}
                        alt=""
                        className="h-10 w-16 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-16 shrink-0 rounded bg-muted" />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {channel.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {channel.id}
                        {typeof channel.videoCount === "number" &&
                          ` · ${channel.videoCount} video${channel.videoCount === 1 ? "" : "s"}`}
                        {usedElsewhere && ` · principal: "${channel.linkedTo}"`}
                        {(channel.linkedCount ?? 0) > 1 &&
                          ` · ${channel.linkedCount} colecciones`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
