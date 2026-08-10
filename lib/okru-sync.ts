import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The incremental half of the ok.ru import: given a channel and the videos
 * scraped from it, work out what the catalog is missing and write it.
 *
 * Two front-ends share this, because only the *scraping* differs between them:
 * `pnpm okru:sync` drives a real browser and scrolls every channel to the end,
 * while /admin/import plain-fetches the first page ok.ru serves (see
 * lib/okru-scraper.ts). What happens to the catalog afterwards has to be
 * identical, hence this module — deliberately free of `server-only` so the
 * script can import it too.
 *
 * The rule everywhere: a collection is matched by its ok.ru channel id, never
 * by title or slug, and only the videos it doesn't have yet are appended.
 * Everything the admin edited — title, poster, genres, published state — is
 * left untouched.
 */

/** A channel as scraped from the profile's "video/channels" page. */
export interface SyncChannel {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  videoCount?: number;
}

/** One video of a channel. Callers pass them sorted oldest first. */
export interface SyncVideo {
  id: string;
  title: string;
  duration?: string;
  thumbnailUrl?: string;
  /** Parsed from the ok.ru title; absent when the title carries no date. */
  streamedAt?: string;
}

/** What one channel's sync did, in a shape both the CLI and the panel can render. */
export type SyncOutcome =
  | { status: "created"; mediaItemId: string; title: string; added: number }
  | {
      status: "updated";
      mediaItemId: string;
      title: string;
      added: number;
      total: number;
      published: boolean;
    }
  | {
      status: "unchanged";
      mediaItemId: string;
      title: string;
      total: number;
      /** Collections built from this channel — more than one after a split. */
      collections: number;
    }
  | { status: "skipped"; title: string; reason: string }
  | { status: "error"; title: string; message: string };

/** The subset of an existing collection the sync needs to decide what to do. */
interface ExistingMediaItem {
  id: string;
  title: string;
  published: boolean;
  okru_channel_id: string | null;
  okru_channel_name: string | null;
  okru_channel_primary: boolean;
}

interface ExistingEpisode {
  episode_number: number;
  season_number: number | null;
  okru_embed_url: string;
  streamed_at: string | null;
}

const VIDEO_ID_IN_EMBED = /\/videoembed\/(\d+)/;

export function videoIdFromEmbedUrl(url: string): string | null {
  return url.match(VIDEO_ID_IN_EMBED)?.[1] ?? null;
}

export function embedUrlForVideoId(videoId: string): string {
  return `https://ok.ru/videoembed/${videoId}`;
}

/** Earliest/latest of a set of "YYYY-MM-DD…" strings — lexicographic order is chronological. */
function streamRangeOf(dates: (string | null | undefined)[]): [string | null, string | null] {
  const sorted = dates.filter((date): date is string => Boolean(date)).sort();
  return [sorted[0] ?? null, sorted[sorted.length - 1] ?? null];
}

/**
 * Channel names are often initials or symbols, and can slugify to nothing, so
 * the channel id is what really keeps the slug unique.
 */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Where to continue numbering when appending videos to a collection that
 * already has episodes: after the last one, inside its season, so the
 * (media_item_id, season_number, episode_number) unique constraint holds and
 * seasons the admin set up stay intact.
 */
function nextEpisodeSlot(episodes: ExistingEpisode[]): {
  seasonNumber: number | null;
  episodeNumber: number;
} {
  if (episodes.length === 0) return { seasonNumber: null, episodeNumber: 1 };

  const last = [...episodes].sort(
    (a, b) =>
      (a.season_number ?? 0) - (b.season_number ?? 0) || a.episode_number - b.episode_number
  )[episodes.length - 1];

  const highestInSeason = episodes
    .filter((episode) => episode.season_number === last.season_number)
    .reduce((max, episode) => Math.max(max, episode.episode_number), 0);

  return { seasonNumber: last.season_number, episodeNumber: highestInSeason + 1 };
}

/**
 * Refreshes the channel catalogue behind the "link this collection to a
 * channel" picker in /admin — the only way to repair a collection imported
 * before the channel id was stored. Returns an error message, if any.
 */
export async function upsertOkRuChannelCatalogue(
  supabase: SupabaseClient,
  channels: SyncChannel[]
): Promise<string | undefined> {
  if (channels.length === 0) return undefined;

  const { error } = await supabase.from("okru_channels").upsert(
    channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      url: channel.url,
      thumbnail_url: channel.thumbnailUrl ?? null,
      video_count: channel.videoCount ?? null,
      last_seen_at: new Date().toISOString(),
    }))
  );

  return error?.message;
}

/**
 * Creates the collection for a channel, or appends to it the videos it doesn't
 * have yet. `videos` is whatever the caller managed to scrape, oldest first —
 * a partial list only means fewer videos are appended, never that anything is
 * removed.
 */
export async function syncOkRuChannel(
  supabase: SupabaseClient,
  channel: SyncChannel,
  videos: SyncVideo[]
): Promise<SyncOutcome> {
  if (videos.length === 0) {
    return { status: "skipped", title: channel.name, reason: "sin videos" };
  }

  const slug = slugify(`${channel.name}-${channel.id}`);

  // Every collection built out of this channel: the primary one receives the
  // new videos, and the rest (movies and such split out of it in /admin)
  // matter because the videos they hold must not be imported again.
  const { data: familyRows, error: lookupError } = await supabase
    .from("media_items")
    .select(
      "id, title, published, okru_channel_id, okru_channel_name, okru_channel_primary, okru_embed_url"
    )
    .eq("okru_channel_id", channel.id);

  if (lookupError) {
    return { status: "error", title: channel.name, message: lookupError.message };
  }

  const family = (familyRows ?? []) as (ExistingMediaItem & { okru_embed_url: string | null })[];
  let existing: ExistingMediaItem | null = family.find((row) => row.okru_channel_primary) ?? null;

  // Collections imported before the channel id was stored: adopt the one still
  // sitting on the slug this sync would generate, so it gets the link instead
  // of being duplicated. Rows already tied to another channel are left alone.
  if (!existing && family.length === 0) {
    const { data: bySlug } = await supabase
      .from("media_items")
      .select("id, title, published, okru_channel_id, okru_channel_name, okru_channel_primary")
      .eq("slug", slug)
      .maybeSingle();
    const candidate = bySlug as ExistingMediaItem | null;
    if (candidate && !candidate.okru_channel_id) existing = candidate;
  }

  // Derived collections only, none primary: the admin unlinked or deleted the
  // main one. Appending to an arbitrary derived collection would scatter the
  // channel, so this needs a human decision.
  if (!existing && family.length > 0) {
    return {
      status: "skipped",
      title: channel.name,
      reason: `${family.length} colecciones del canal pero ninguna principal`,
    };
  }

  if (!existing) return createCollection(supabase, channel, videos, slug);

  return appendNewVideos(supabase, channel, videos, existing, family);
}

async function createCollection(
  supabase: SupabaseClient,
  channel: SyncChannel,
  videos: SyncVideo[],
  slug: string
): Promise<SyncOutcome> {
  // Videos arrive sorted chronologically, so the range is the ends.
  const dated = videos.filter((video) => video.streamedAt);
  const firstStreamedAt = dated[0]?.streamedAt ?? null;
  const lastStreamedAt = dated[dated.length - 1]?.streamedAt ?? null;

  const { data, error } = await supabase
    .from("media_items")
    .insert({
      title: channel.name,
      slug,
      type: "series" as const,
      poster_url: channel.thumbnailUrl ?? videos[0]?.thumbnailUrl ?? "",
      genres: [] as string[],
      description: null,
      status: "ongoing" as const,
      published: false,
      first_streamed_at: firstStreamedAt,
      last_streamed_at: lastStreamedAt,
      okru_channel_id: channel.id,
      okru_channel_name: channel.name,
      okru_channel_url: channel.url,
      okru_channel_primary: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      title: channel.name,
      message: error?.message ?? "No se pudo crear la colección.",
    };
  }

  const mediaItemId = data.id as string;
  const { error: episodesError } = await supabase
    .from("episodes")
    .insert(episodeRows(mediaItemId, videos, { seasonNumber: null, episodeNumber: 1 }));

  if (episodesError) {
    return { status: "error", title: channel.name, message: episodesError.message };
  }

  return { status: "created", mediaItemId, title: channel.name, added: videos.length };
}

async function appendNewVideos(
  supabase: SupabaseClient,
  channel: SyncChannel,
  videos: SyncVideo[],
  existing: ExistingMediaItem,
  family: (ExistingMediaItem & { okru_embed_url: string | null })[]
): Promise<SyncOutcome> {
  const mediaItemId = existing.id;

  // Episodes of every collection of this channel, not just the primary one: a
  // video moved into a collection of its own is still imported, and must not
  // come back here.
  const familyIds = family.length > 0 ? family.map((row) => row.id) : [mediaItemId];
  const { data: familyEpisodeRows, error: episodesLookupError } = await supabase
    .from("episodes")
    .select("media_item_id, episode_number, season_number, okru_embed_url, streamed_at")
    .in("media_item_id", familyIds);

  if (episodesLookupError) {
    return { status: "error", title: existing.title, message: episodesLookupError.message };
  }

  const familyEpisodes = (familyEpisodeRows ?? []) as (ExistingEpisode & {
    media_item_id: string;
  })[];
  const existingEpisodes = familyEpisodes.filter(
    (episode) => episode.media_item_id === mediaItemId
  );

  const knownVideoIds = new Set(
    [
      // Movies and other single-video collections keep their video on the item
      // itself, with no episode row to find it by.
      ...family.map((row) => row.okru_embed_url),
      ...familyEpisodes.map((episode) => episode.okru_embed_url),
    ]
      .map((url) => (url ? videoIdFromEmbedUrl(url) : null))
      .filter((id): id is string => Boolean(id))
  );
  const newVideos = videos.filter((video) => !knownVideoIds.has(video.id));

  // Only what this collection ends up holding: dates already stored (typed by
  // the admin, in some cases) plus the videos about to be appended. Videos that
  // now live in a collection of their own are somebody else's range.
  const [rangeStart, rangeEnd] = streamRangeOf([
    ...existingEpisodes.map((episode) => episode.streamed_at),
    ...newVideos.map((video) => video.streamedAt),
  ]);

  const refresh: Record<string, unknown> = {
    okru_channel_id: channel.id,
    okru_channel_name: channel.name,
    okru_channel_url: channel.url,
    okru_channel_primary: true,
    first_streamed_at: rangeStart,
    last_streamed_at: rangeEnd,
  };

  // The title only follows ok.ru while it still matches the channel name — i.e.
  // while the admin hasn't renamed the collection. The slug never changes:
  // public links point at it.
  if (existing.okru_channel_name && existing.title === existing.okru_channel_name) {
    refresh.title = channel.name;
  }

  const { error: updateError } = await supabase
    .from("media_items")
    .update(refresh)
    .eq("id", mediaItemId);

  if (updateError) {
    return { status: "error", title: existing.title, message: updateError.message };
  }

  if (newVideos.length === 0) {
    return {
      status: "unchanged",
      mediaItemId,
      title: existing.title,
      total: existingEpisodes.length,
      collections: family.length,
    };
  }

  const { error: insertError } = await supabase
    .from("episodes")
    .insert(episodeRows(mediaItemId, newVideos, nextEpisodeSlot(existingEpisodes)));

  if (insertError) {
    return { status: "error", title: existing.title, message: insertError.message };
  }

  return {
    status: "updated",
    mediaItemId,
    title: existing.title,
    added: newVideos.length,
    total: existingEpisodes.length + newVideos.length,
    published: existing.published,
  };
}

function episodeRows(
  mediaItemId: string,
  videos: SyncVideo[],
  slot: { seasonNumber: number | null; episodeNumber: number }
) {
  return videos.map((video, index) => ({
    media_item_id: mediaItemId,
    episode_number: slot.episodeNumber + index,
    season_number: slot.seasonNumber,
    title: video.title,
    okru_embed_url: embedUrlForVideoId(video.id),
    duration: video.duration ?? null,
    thumbnail_url: video.thumbnailUrl ?? null,
    streamed_at: video.streamedAt ?? null,
  }));
}
