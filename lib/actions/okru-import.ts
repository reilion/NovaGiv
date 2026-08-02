"use server";

import { requireAdminClient } from "@/lib/actions/require-admin";
import {
  fetchOkRuChannels,
  fetchOkRuChannelVideos,
  type OkRuChannel,
  type OkRuVideo,
} from "@/lib/okru-scraper";

export interface ListChannelsResult {
  channels?: OkRuChannel[];
  error?: string;
}

export interface ListVideosResult {
  videos?: OkRuVideo[];
  error?: string;
}

/** A channel offered in the "link this collection to a channel" picker. */
export interface LinkableOkRuChannel {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  videoCount?: number;
  /** Title of the collection that receives this channel's new videos, if it already exists. */
  linkedTo?: string;
  /** How many collections were built from this channel — more than one after splitting it. */
  linkedCount?: number;
}

export interface LinkableChannelsResult {
  channels?: LinkableOkRuChannel[];
  /** "db" = the catalogue `pnpm okru:sync` maintains; "live" = a fallback read of the profile page (first 20 only). */
  source?: "db" | "live";
  error?: string;
}

const DEFAULT_PROFILE_URL =
  process.env.OKRU_PROFILE_URL ?? "https://ok.ru/profile/597703328549/video/channels";

interface OkRuChannelRow {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  video_count: number | null;
}

/**
 * Channels the admin can attach to an existing collection — for the ones
 * imported before the channel id was stored, whose title no longer resembles
 * the channel's, and for collections split off a channel by hand. Reads the
 * catalogue filled by `pnpm okru:sync`; if that has never run, falls back to
 * scraping the profile page (capped at 20 by ok.ru's lazy loading, hence the
 * `source` flag).
 */
export async function listLinkableOkRuChannels(): Promise<LinkableChannelsResult> {
  const supabase = await requireAdminClient();

  const [{ data: channelRows, error }, { data: linkedRows }] = await Promise.all([
    supabase.from("okru_channels").select("*").order("name"),
    supabase
      .from("media_items")
      .select("title, okru_channel_id, okru_channel_primary")
      .not("okru_channel_id", "is", null),
  ]);

  if (error) return { error: error.message };

  // Several collections may come from one channel; the primary is the one
  // worth naming, since it's where the sync keeps adding videos.
  const primaryByChannel = new Map<string, string>();
  const countByChannel = new Map<string, number>();
  for (const row of linkedRows ?? []) {
    const channelId = row.okru_channel_id as string;
    countByChannel.set(channelId, (countByChannel.get(channelId) ?? 0) + 1);
    if (row.okru_channel_primary) primaryByChannel.set(channelId, row.title as string);
  }

  const linkage = (channelId: string) => ({
    linkedTo: primaryByChannel.get(channelId),
    linkedCount: countByChannel.get(channelId),
  });

  if (channelRows && channelRows.length > 0) {
    return {
      source: "db",
      channels: (channelRows as OkRuChannelRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        thumbnailUrl: row.thumbnail_url ?? undefined,
        videoCount: row.video_count ?? undefined,
        ...linkage(row.id),
      })),
    };
  }

  try {
    const channels = await fetchOkRuChannels(DEFAULT_PROFILE_URL);
    return {
      source: "live",
      channels: channels.map((channel) => ({
        ...channel,
        ...linkage(channel.id),
      })),
    };
  } catch (fetchError) {
    return {
      error:
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron leer los canales de ok.ru.",
    };
  }
}

/** Requires an admin session so this can't be used as an open scraping proxy. */
export async function listOkRuChannels(channelsUrl: string): Promise<ListChannelsResult> {
  await requireAdminClient();

  try {
    const channels = await fetchOkRuChannels(channelsUrl);
    return { channels };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer ok.ru." };
  }
}

export async function listOkRuChannelVideos(channelUrl: string): Promise<ListVideosResult> {
  await requireAdminClient();

  try {
    const videos = await fetchOkRuChannelVideos(channelUrl);
    return { videos };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer ok.ru." };
  }
}
