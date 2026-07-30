"use client";

/* eslint-disable @next/next/no-img-element -- admin-only preview of remote ok.ru thumbnails, no next/image needed here */

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { MediaForm } from "@/components/admin/media-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listOkRuChannels,
  listOkRuChannelVideos,
} from "@/lib/actions/okru-import";
import type { OkRuChannel, OkRuVideo } from "@/lib/okru-scraper";
import { cn } from "@/lib/utils";

const DEFAULT_CHANNELS_URL = "https://ok.ru/profile/597703328549/video/channels";

export function OkRuImportPanel() {
  const [channelsUrl, setChannelsUrl] = useState(DEFAULT_CHANNELS_URL);
  const [channels, setChannels] = useState<OkRuChannel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [isLoadingChannels, startLoadingChannels] = useTransition();

  const [selectedChannel, setSelectedChannel] = useState<OkRuChannel | null>(null);
  const [videos, setVideos] = useState<OkRuVideo[] | null>(null);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [isLoadingVideos, startLoadingVideos] = useTransition();

  function handleLoadChannels() {
    setChannelsError(null);
    setChannels(null);
    setSelectedChannel(null);
    setVideos(null);
    startLoadingChannels(async () => {
      const result = await listOkRuChannels(channelsUrl);
      if (result.error) setChannelsError(result.error);
      else setChannels(result.channels ?? []);
    });
  }

  function handleSelectChannel(channel: OkRuChannel) {
    setSelectedChannel(channel);
    setVideos(null);
    setVideosError(null);
    startLoadingVideos(async () => {
      const result = await listOkRuChannelVideos(channel.url);
      if (result.error) setVideosError(result.error);
      else setVideos(result.videos ?? []);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Canales de ok.ru</CardTitle>
          <CardDescription>
            Cada canal del perfil se importa como una colección aparte (serie, anime o
            especial). Solo lee la página pública — no necesita iniciar sesión en ok.ru.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={channelsUrl}
              onChange={(event) => setChannelsUrl(event.target.value)}
              placeholder="https://ok.ru/profile/.../video/channels"
              className="flex-1"
            />
            <Button type="button" onClick={handleLoadChannels} disabled={isLoadingChannels}>
              {isLoadingChannels ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Buscar canales
            </Button>
          </div>

          {channelsError && <p className="text-sm text-destructive">{channelsError}</p>}

          {channels && channels.length === 0 && !channelsError && (
            <p className="text-sm text-muted-foreground">No se encontraron canales.</p>
          )}

          {channels && channels.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => handleSelectChannel(channel)}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary",
                    selectedChannel?.id === channel.id
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  )}
                >
                  {channel.thumbnailUrl ? (
                    <img
                      src={channel.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="aspect-video w-full rounded-md bg-muted" />
                  )}
                  <span className="font-medium text-foreground">{channel.name}</span>
                  {typeof channel.videoCount === "number" && (
                    <span className="text-xs text-muted-foreground">
                      {channel.videoCount} video{channel.videoCount === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedChannel && (
        <Card>
          <CardHeader>
            <CardTitle>2. Videos de &ldquo;{selectedChannel.name}&rdquo;</CardTitle>
            <CardDescription>
              Se cargan como episodios (orden cronológico) en el formulario de abajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isLoadingVideos && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Cargando videos…
              </p>
            )}
            {videosError && <p className="text-sm text-destructive">{videosError}</p>}
            {videos && videos.length === 0 && !videosError && (
              <p className="text-sm text-muted-foreground">Este canal no tiene videos.</p>
            )}
            {videos && videos.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {videos.length} video{videos.length === 1 ? "" : "s"} encontrados. Completa lo
                que falte abajo — el título se guarda como borrador hasta que lo publiques.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {videos && videos.length > 0 && (
        <MediaForm
          key={selectedChannel?.id}
          initialValues={{
            title: selectedChannel?.name,
            type: "series",
            posterUrl: videos[0]?.thumbnailUrl,
            published: false,
            episodes: videos.map((video, index) => ({
              episodeNumber: index + 1,
              title: video.title,
              okRuEmbedUrl: video.embedUrl,
              duration: video.duration,
            })),
          }}
        />
      )}
    </div>
  );
}
