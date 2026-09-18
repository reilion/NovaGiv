import "server-only";

import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { findEpisodeByParam } from "@/lib/episode-param";
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
  view_count: number | null;
  like_count: number | null;
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
  okru_channel_id: string | null;
  okru_channel_name: string | null;
  okru_channel_url: string | null;
  okru_channel_primary: boolean | null;
  view_count: number | null;
  like_count: number | null;
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
    views: row.view_count ?? 0,
    likes: row.like_count ?? 0,
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
    okruChannelId: row.okru_channel_id ?? undefined,
    okruChannelName: row.okru_channel_name ?? undefined,
    okruChannelUrl: row.okru_channel_url ?? undefined,
    okruChannelPrimary: row.okru_channel_primary ?? undefined,
    views: row.view_count ?? 0,
    likes: row.like_count ?? 0,
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

/**
 * Single published item by slug — what /v/[slug] and the modal that intercepts
 * it render.
 *
 * Request-cached because one view of a title asks for it up to three times:
 * `generateMetadata`, the page itself, and the OG image route.
 */
export const getMediaBySlug = cache(async function getMediaBySlug(
  slug: string
): Promise<MediaItem | null> {
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
});

export interface SitemapEntry {
  slug: string;
  /** Newest of the stream date and the row's creation, as an ISO string. */
  lastModified: string;
}

/**
 * Slugs for app/sitemap.ts.
 *
 * Deliberately not `getMediaItems()`: that one reads the request's cookies, and
 * a sitemap is produced without a request. This goes through a session-less
 * client instead — the anon key sees exactly what an anonymous visitor sees, so
 * RLS keeps drafts out of the sitemap on its own.
 */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  if (!isSupabaseConfigured) {
    return MOCK_MEDIA.filter((item) => item.published !== false).map((item) => ({
      slug: item.slug,
      lastModified: item.lastStreamedAt ?? item.createdAt,
    }));
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("media_items")
    .select("slug, last_streamed_at, created_at")
    .eq("published", true);

  if (error || !data) {
    console.error("getSitemapEntries error —", error?.message);
    return [];
  }

  return data.map((row) => ({
    slug: row.slug as string,
    lastModified: (row.last_streamed_at as string | null) ?? (row.created_at as string),
  }));
}

/** One video of the catalog, as "Mis me gusta", "Ver después" and the history list show it. */
export interface VideoEntry {
  item: MediaItem;
  /** Absent for a collection's own video: a movie, karaoke or especial. */
  episode?: Episode;
  /** When it was liked, saved, or last opened. ISO timestamp. */
  at: string;
}

/**
 * Resolves rows that point at a video against the catalog the visitor can
 * actually see.
 *
 * Going through `getMediaItems()` rather than joining in the query is on
 * purpose: it is already loaded and request-cached, and it only ever contains
 * published collections, so a title unpublished since — or an episode the admin
 * has rewritten away — simply drops out of the list instead of rendering as a
 * dead row.
 */
async function resolveVideoEntries<T>(
  rows: T[],
  pick: (row: T) => { mediaItemId: string; at: string; episodeOf: (item: MediaItem) => Episode | undefined | null }
): Promise<VideoEntry[]> {
  const items = await getMediaItems();
  const byId = new Map(items.map((item) => [item.id, item]));

  return rows.flatMap((row) => {
    const { mediaItemId, at, episodeOf } = pick(row);
    const item = byId.get(mediaItemId);
    if (!item) return [];

    const episode = episodeOf(item);
    // null means "this row named an episode, and it is gone".
    if (episode === null) return [];

    return [{ item, episode: episode ?? undefined, at }];
  });
}

/**
 * Every video the signed-in account has liked, newest first. `null` means there
 * is no session, which is what sends /me-gusta to the login form.
 */
export const getLikedVideos = cache(async function getLikedVideos(): Promise<VideoEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // No user filter needed: RLS only ever hands back your own likes.
  const { data, error } = await supabase
    .from("video_likes")
    .select("media_item_id, episode_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getLikedVideos error —", error.message);
    return [];
  }

  return resolveVideoEntries(data ?? [], (row) => ({
    mediaItemId: row.media_item_id as string,
    at: row.created_at as string,
    episodeOf: (item) => {
      const episodeId = row.episode_id as string | null;
      if (!episodeId) return undefined;
      return item.episodes?.find((episode) => episode.id === episodeId) ?? null;
    },
  }));
});

/**
 * The account's "Ver después" list, most recently saved first. `null` means
 * there is no session, which is what sends /ver-despues to the login form.
 *
 * Fails soft for the same reason as the history below: until
 * `supabase/schema.sql` is re-run, `watch_later` does not exist.
 */
export const getWatchLaterVideos = cache(async function getWatchLaterVideos(): Promise<
  VideoEntry[] | null
> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("watch_later")
    .select("media_item_id, episode_ref, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getWatchLaterVideos error —", error.message);
    return [];
  }

  return resolveVideoEntries(data ?? [], (row) => ({
    mediaItemId: row.media_item_id as string,
    at: row.created_at as string,
    episodeOf: (item) => {
      const ref = row.episode_ref as string | null;
      if (!ref) return undefined;
      // Unlike the history, a saved episode that no longer resolves drops out:
      // the row named one video, and playing another in its place would be a
      // different thing from what was saved.
      return findEpisodeByParam(item.episodes ?? [], ref) ?? null;
    },
  }));
});

/**
 * What the account has been watching, most recent first — one entry per
 * collection, pointing at the episode to resume from.
 *
 * Fails soft on purpose: until `supabase/schema.sql` is re-run, `watch_history`
 * does not exist, and a catalog that refuses to render because of a table
 * nobody has created yet would be a worse bug than a missing shelf.
 */
export const getWatchHistory = cache(async function getWatchHistory(): Promise<
  VideoEntry[] | null
> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("watch_history")
    .select("media_item_id, episode_ref, watched_at")
    .order("watched_at", { ascending: false });

  if (error) {
    console.error("getWatchHistory error —", error.message);
    return [];
  }

  return resolveVideoEntries(data ?? [], (row) => ({
    mediaItemId: row.media_item_id as string,
    at: row.watched_at as string,
    episodeOf: (item) => {
      const ref = row.episode_ref as string | null;
      if (!ref) return undefined;
      // A ref that no longer resolves means the episode list was rewritten; the
      // collection is still worth showing, just from its start.
      return findEpisodeByParam(item.episodes ?? [], ref) ?? undefined;
    },
  }));
});

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

/** Where the person browsing stands on the videos of one collection. */
export interface ViewerVideoIds {
  /** Videos they have liked. */
  liked: string[];
  /** Videos on their "Ver después" list. */
  saved: string[];
}

/**
 * Which videos of one collection the person browsing has liked or saved for
 * later, as the ids the player keys on: the episode's for an episodic
 * collection, the collection's own for a movie, karaoke or especial.
 *
 * `null` means nobody is signed in — the difference between "liked nothing" and
 * "cannot like yet", which is what turns both buttons into links to the login
 * form. Scoped to the open collection because that is the only one whose
 * buttons are on screen; the totals the cards show come off the catalog rows.
 *
 * One lookup of the session for both lists: `getUser()` is a round trip to the
 * auth server, not a cookie read.
 */
export async function getViewerVideoIds(item: MediaItem): Promise<ViewerVideoIds | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [likes, later] = await Promise.all([
    supabase.from("video_likes").select("media_item_id, episode_id").eq("media_item_id", item.id),
    supabase.from("watch_later").select("episode_ref").eq("media_item_id", item.id),
  ]);

  if (likes.error) console.error("getViewerVideoIds likes error —", likes.error.message);
  if (later.error) console.error("getViewerVideoIds watch later error —", later.error.message);

  return {
    liked: (likes.data ?? []).map((row) => row.episode_id ?? row.media_item_id),
    // Saved rows name an episode by its ref; the player wants the id it has now.
    saved: (later.data ?? []).flatMap((row) => {
      const ref = row.episode_ref as string | null;
      if (!ref) return [item.id];
      const episode = findEpisodeByParam(item.episodes ?? [], ref);
      return episode ? [episode.id] : [];
    }),
  };
}

/** Streamer profile/socials. Swap for a `streamer_profile` table when one exists. */
export async function getStreamerProfile(): Promise<StreamerProfile> {
  return MOCK_STREAMER;
}
