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
