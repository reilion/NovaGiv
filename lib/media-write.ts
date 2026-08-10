import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toOkRuEmbedUrl } from "@/lib/okru";
import type { EpisodeInput, MediaFormInput } from "@/types/media";

/**
 * The write half of the admin catalog: shared by the media form and by the
 * actions that split a channel's videos into several collections, so every
 * path stores a collection exactly the same way.
 */

export interface WriteResult {
  id?: string;
  error?: string;
}

/** Turns Postgres' unique-violation jargon into something actionable in the form. */
export function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code !== "23505") return error.message;
  if (error.message.includes("okru_channel")) {
    return "Ese canal de ok.ru ya tiene una colección principal. Desvincúlala allí primero.";
  }
  if (error.message.includes("slug")) {
    return "Ya existe otro título con ese slug.";
  }
  return error.message;
}

/** Earliest/latest of a set of "YYYY-MM-DD…" strings — lexicographic order is chronological. */
export function streamRangeOf(dates: (string | null | undefined)[]): [string | null, string | null] {
  const sorted = dates
    .map((date) => date?.trim())
    .filter((date): date is string => Boolean(date))
    .sort();
  return [sorted[0] ?? null, sorted[sorted.length - 1] ?? null];
}

export function episodeRowsFor(
  mediaItemId: string,
  episodes: EpisodeInput[],
  /** Plays already recorded for these videos, by embed url — see `viewCountsByEmbedUrl`. */
  views?: Map<string, number>
) {
  return episodes.map((episode) => {
    const embedUrl = toOkRuEmbedUrl(episode.okRuEmbedUrl.trim());
    return {
      media_item_id: mediaItemId,
      episode_number: episode.episodeNumber,
      season_number: episode.seasonNumber ?? null,
      title: episode.title.trim(),
      okru_embed_url: embedUrl,
      duration: episode.duration?.trim() || null,
      thumbnail_url: episode.thumbnailUrl?.trim() || null,
      streamed_at: episode.streamedAt?.trim() || null,
      view_count: views?.get(embedUrl) ?? 0,
    };
  });
}

/**
 * Plays recorded so far for a set of ok.ru videos, keyed by embed url.
 *
 * The counter lives on the episode row, but saving a collection replaces every
 * one of those rows, so the count has to be carried over by what identifies the
 * video itself — its ok.ru URL. Looked up across the whole table, not just one
 * collection, so a video pulled in from a sibling collection arrives with its
 * views. Reading it always has to happen *before* the rows are deleted.
 */
export async function viewCountsByEmbedUrl(
  supabase: SupabaseClient,
  urls: string[]
): Promise<Map<string, number>> {
  const views = new Map<string, number>();
  if (urls.length === 0) return views;

  const { data } = await supabase
    .from("episodes")
    .select("okru_embed_url, view_count")
    .in("okru_embed_url", urls);

  for (const row of data ?? []) {
    const url = row.okru_embed_url as string;
    const count = (row.view_count as number | null) ?? 0;
    // The same video can still sit in two collections mid-move; the higher
    // count is the one that has been accumulating.
    views.set(url, Math.max(views.get(url) ?? 0, count));
  }

  return views;
}

/**
 * Moves the plays of a video that lived as an episode onto the collection that
 * now stores it on the item itself — a movie split out of a channel. Call it
 * while the episode row still exists; adding (not assigning) keeps whatever the
 * collection had counted on its own.
 */
export async function carryEpisodeViewsToItem(
  supabase: SupabaseClient,
  mediaItemId: string,
  embedUrl: string
) {
  const carried = (await viewCountsByEmbedUrl(supabase, [embedUrl])).get(embedUrl) ?? 0;
  if (carried === 0) return;

  const { data } = await supabase
    .from("media_items")
    .select("view_count")
    .eq("id", mediaItemId)
    .maybeSingle();

  await supabase
    .from("media_items")
    .update({ view_count: ((data?.view_count as number | null) ?? 0) + carried })
    .eq("id", mediaItemId);
}

/**
 * Recomputes a collection's stream range from the episodes it has left —
 * needed after moving episodes out of it into another collection.
 */
export async function refreshStreamRange(supabase: SupabaseClient, mediaItemId: string) {
  const { data } = await supabase
    .from("episodes")
    .select("streamed_at")
    .eq("media_item_id", mediaItemId);

  const [first, last] = streamRangeOf((data ?? []).map((row) => row.streamed_at as string | null));

  await supabase
    .from("media_items")
    .update({ first_streamed_at: first, last_streamed_at: last })
    .eq("id", mediaItemId);
}

/**
 * Exactly one collection per channel receives the videos `pnpm okru:sync`
 * finds. The first one linked to a channel claims that role; anything linked
 * afterwards (a movie split out of the channel, a manual link) is derived.
 */
async function resolveChannelPrimary(
  supabase: SupabaseClient,
  channelId: string,
  mediaItemId?: string
): Promise<boolean> {
  const { data } = await supabase
    .from("media_items")
    .select("id")
    .eq("okru_channel_id", channelId)
    .eq("okru_channel_primary", true)
    .maybeSingle();

  return !data || data.id === mediaItemId;
}

/**
 * Creates or updates a collection and replaces its episode list. Episodes
 * marked as claimed from another collection are deleted there afterwards, so
 * the same ok.ru video never lives in two collections.
 */
export async function writeMediaItem(
  supabase: SupabaseClient,
  input: MediaFormInput
): Promise<WriteResult> {
  const title = input.title.trim();
  const slug = input.slug.trim();

  if (!title || !slug) return { error: "Título y slug son obligatorios." };
  if (!input.posterUrl.trim()) return { error: "La URL del póster es obligatoria." };

  // Kept derived rather than hand-entered so the range can never drift from
  // the episodes it summarises. Single-video collections have no episodes to
  // derive it from, so they carry the date themselves.
  const [firstStreamedAt, lastStreamedAt] =
    input.episodes.length > 0
      ? streamRangeOf(input.episodes.map((episode) => episode.streamedAt))
      : streamRangeOf([input.streamedAt]);

  const row: Record<string, unknown> = {
    title,
    slug,
    type: input.type,
    poster_url: input.posterUrl.trim(),
    genres: input.genres,
    year: input.year ?? null,
    description: input.description?.trim() || null,
    duration: input.duration?.trim() || null,
    okru_embed_url: input.okRuEmbedUrl?.trim() ? toOkRuEmbedUrl(input.okRuEmbedUrl.trim()) : null,
    status: input.status ?? null,
    rating: input.rating ?? null,
    published: input.published,
    first_streamed_at: firstStreamedAt,
    last_streamed_at: lastStreamedAt,
  };

  // Omitted (not nulled) when the caller doesn't manage the link, so a write
  // from a form that never loaded it can't wipe it.
  if (input.okruChannel !== undefined) {
    row.okru_channel_id = input.okruChannel?.id ?? null;
    row.okru_channel_name = input.okruChannel?.name ?? null;
    row.okru_channel_url = input.okruChannel?.url ?? null;
    row.okru_channel_primary = input.okruChannel
      ? await resolveChannelPrimary(supabase, input.okruChannel.id, input.id)
      : false;
  }

  let mediaItemId = input.id;

  if (mediaItemId) {
    const { error } = await supabase.from("media_items").update(row).eq("id", mediaItemId);
    if (error) return { error: describeWriteError(error) };
  } else {
    const { data, error } = await supabase.from("media_items").insert(row).select("id").single();
    if (error || !data) {
      return { error: error ? describeWriteError(error) : "No se pudo crear el título." };
    }
    mediaItemId = data.id as string;
  }

  // Read before the delete below wipes the rows holding these counters.
  const carriedViews = await viewCountsByEmbedUrl(
    supabase,
    input.episodes.map((episode) => toOkRuEmbedUrl(episode.okRuEmbedUrl.trim()))
  );

  // Simplest way to keep the episode list in sync with a dynamic admin form:
  // replace them all rather than diffing add/edit/remove individually.
  const { error: deleteError } = await supabase
    .from("episodes")
    .delete()
    .eq("media_item_id", mediaItemId);
  if (deleteError) return { error: deleteError.message };

  if (input.episodes.length > 0) {
    const { error } = await supabase
      .from("episodes")
      .insert(episodeRowsFor(mediaItemId, input.episodes, carriedViews));
    if (error) return { error: error.message };
  }

  const claimedIds = input.episodes
    .map((episode) => episode.claimedFromEpisodeId)
    .filter((id): id is string => Boolean(id));

  if (claimedIds.length > 0) {
    const error = await releaseClaimedEpisodes(supabase, claimedIds);
    if (error) return { error };
  }

  return { id: mediaItemId };
}

/**
 * Removes the rows an episode was copied from — the second half of "move this
 * episode into that collection" — and rebuilds the stream range of whatever
 * collections lost episodes.
 */
async function releaseClaimedEpisodes(
  supabase: SupabaseClient,
  episodeIds: string[]
): Promise<string | undefined> {
  const { data: origins } = await supabase
    .from("episodes")
    .select("id, media_item_id")
    .in("id", episodeIds);

  if (!origins || origins.length === 0) return undefined;

  const { error } = await supabase
    .from("episodes")
    .delete()
    .in(
      "id",
      origins.map((row) => row.id as string)
    );
  if (error) return error.message;

  const affected = new Set(origins.map((row) => row.media_item_id as string));
  for (const id of affected) await refreshStreamRange(supabase, id);

  return undefined;
}
