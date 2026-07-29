import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MOCK_MEDIA, MOCK_STREAMER } from "@/lib/mock-data";
import type { Episode, MediaItem } from "@/types/media";
import type { StreamerProfile } from "@/types/streamer";

const isSupabaseConfigured = Boolean(
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
    createdAt: row.created_at,
    episodes: row.episodes?.length
      ? row.episodes
          .map(mapEpisode)
          .sort((a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || a.episodeNumber - b.episodeNumber)
      : undefined,
  };
}

/** All catalog items, newest first. Falls back to local demo data until Supabase env vars are set. */
export async function getMediaItems(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) return MOCK_MEDIA;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select("*, episodes(*)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("getMediaItems: falling back to mock data —", error?.message);
    return MOCK_MEDIA;
  }

  return (data as MediaItemRow[]).map(mapMediaItem);
}

/** Single item by slug, used by the video player modal / detail route. */
export async function getMediaBySlug(slug: string): Promise<MediaItem | null> {
  if (!isSupabaseConfigured) {
    return MOCK_MEDIA.find((item) => item.slug === slug) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .select("*, episodes(*)")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getMediaBySlug error —", error.message);
    return null;
  }

  return mapMediaItem(data as MediaItemRow);
}

/** Streamer profile/socials. Swap for a `streamer_profile` table when one exists. */
export async function getStreamerProfile(): Promise<StreamerProfile> {
  return MOCK_STREAMER;
}
