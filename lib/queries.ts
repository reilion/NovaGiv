import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { MOCK_MEDIA, MOCK_STREAMER } from "@/lib/mock-data";
import type { Episode, MediaItem } from "@/types/media";
import type { StreamerProfile } from "@/types/streamer";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface EpisodeRow {
  id: string;
  episode_number: number;
  season_number: number | null;
  title: string;
  okru_embed_url: string;
  duration: string | null;
  thumbnail_url: string | null;
  streamed_at: string | null;
}

interface MediaItemRow {
  id: string;
  title: string;
  slug: string;
  type: MediaItem["type"];
  poster_url: string;
  genres: string[];
  year: number | null;
  description: string | null;
  duration: string | null;
  okru_embed_url: string | null;
  status: MediaItem["status"] | null;
  rating: number | null;
  published: boolean;
  first_streamed_at: string | null;
  last_streamed_at: string | null;
  created_at: string;
  episodes: EpisodeRow[] | null;
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    episodeNumber: row.episode_number,
    seasonNumber: row.season_number ?? undefined,
    title: row.title,
    okRuEmbedUrl: row.okru_embed_url,
    duration: row.duration ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    // Postgres returns "2026-07-28T00:19:09" for `timestamp` columns; keep it
    // as a plain string so no timezone conversion ever happens.
    streamedAt: row.streamed_at ?? undefined,
  };
}

function mapMediaItem(row: MediaItemRow): MediaItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    posterUrl: row.poster_url,
    genres: row.genres ?? [],
    year: row.year ?? undefined,
    description: row.description ?? undefined,
    duration: row.duration ?? undefined,
    okRuEmbedUrl: row.okru_embed_url ?? undefined,
    status: row.status ?? undefined,
    rating: row.rating ?? undefined,
    published: row.published,
    firstStreamedAt: row.first_streamed_at ?? undefined,
    lastStreamedAt: row.last_streamed_at ?? undefined,
    createdAt: row.created_at,
    episodes: row.episodes?.length
      ? row.episodes
          .map(mapEpisode)
          .sort((a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || a.episodeNumber - b.episodeNumber)
      : undefined,
  };
}

/**
 * Published catalog items, newest first — what the public site shows. Falls
 * back to local demo data until Supabase env vars are set.
 *
 * Wrapped in React `cache` so the page and its Suspense children can each ask
 * for the catalog without issuing duplicate queries per request.
 */
export const getMediaItems = cache(async function getMediaItems(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) return MOCK_MEDIA.filter((item) => item.published !== false);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select("*, episodes(*)")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("getMediaItems: falling back to mock data —", error?.message);
    return MOCK_MEDIA.filter((item) => item.published !== false);
  }

  return (data as MediaItemRow[]).map(mapMediaItem);
});

/**
 * Every catalog item regardless of published state — for the admin
 * dashboard, so drafts (e.g. ok.ru imports awaiting review) show up there.
 */
export async function getAllMediaItemsForAdmin(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) return MOCK_MEDIA;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select("*, episodes(*)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("getAllMediaItemsForAdmin: falling back to mock data —", error?.message);
    return MOCK_MEDIA;
  }

  return (data as MediaItemRow[]).map(mapMediaItem);
}

/** Single published item by slug, used by the video player modal / detail route. */
export async function getMediaBySlug(slug: string): Promise<MediaItem | null> {
  if (!isSupabaseConfigured) {
    return MOCK_MEDIA.find((item) => item.slug === slug && item.published !== false) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select("*, episodes(*)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getMediaBySlug error —", error.message);
    return null;
  }

  return mapMediaItem(data as MediaItemRow);
}

/** Single item by primary key, used by the admin edit form. */
export async function getMediaItemById(id: string): Promise<MediaItem | null> {
  if (!isSupabaseConfigured) {
    return MOCK_MEDIA.find((item) => item.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select("*, episodes(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getMediaItemById error —", error.message);
    return null;
  }

  return mapMediaItem(data as MediaItemRow);
}

/** Streamer profile/socials. Swap for a `streamer_profile` table when one exists. */
export async function getStreamerProfile(): Promise<StreamerProfile> {
  return MOCK_STREAMER;
}
