"use server";

import { revalidatePath } from "next/cache";

import { requireAdminClient } from "@/lib/actions/require-admin";
import { OKRU_SYNC_CHANNEL_LIMIT } from "@/lib/constants";
import { fetchOkRuChannels, fetchOkRuChannelVideos } from "@/lib/okru-scraper";
import {
  syncOkRuChannel,
  upsertOkRuChannelCatalogue,
  type SyncChannel,
  type SyncOutcome,
} from "@/lib/okru-sync";

export interface SyncChannelsResult {
  channels?: SyncChannel[];
  error?: string;
}

export interface SyncChannelResult {
  outcome?: SyncOutcome;
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

/**
 * The channels the panel is going to sync: the most recent ones, as ok.ru
 * serves them on the first page of the profile (newest first, 20 per page).
 *
 * Requires an admin session — this also stops the scraper from being used as an
 * open proxy.
 */
export async function listOkRuSyncChannels(): Promise<SyncChannelsResult> {
  const supabase = await requireAdminClient();

  try {
    const channels = await fetchOkRuChannels(DEFAULT_PROFILE_URL);

    // Everything the page returned goes into the catalogue behind the "link a
    // channel" picker, even the ones beyond the limit: it costs nothing and
    // keeps that list fresher.
    const catalogueError = await upsertOkRuChannelCatalogue(supabase, channels);
    if (catalogueError) console.error("okru sync: catálogo de canales —", catalogueError);

    return { channels: channels.slice(0, OKRU_SYNC_CHANNEL_LIMIT) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudieron leer los canales de ok.ru.",
    };
  }
}

/**
 * Syncs one channel — the same incremental write `pnpm okru:sync` does, over
 * the videos ok.ru serves without scrolling (the newest 20 of the channel).
 *
 * One channel per call on purpose: the panel drives the loop, so it can show
 * progress as it goes and no single request has to outlive a serverless
 * function's timeout.
 */
export async function syncOkRuChannelNow(channel: SyncChannel): Promise<SyncChannelResult> {
  const supabase = await requireAdminClient();

  let videos;
  try {
    videos = await fetchOkRuChannelVideos(channel.url);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer ok.ru." };
  }

  const outcome = await syncOkRuChannel(supabase, channel, videos);

  if (outcome.status === "created" || outcome.status === "updated") {
    revalidatePath("/");
    revalidatePath("/admin");
  }

  return { outcome };
}
