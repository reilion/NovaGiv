import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseMediaFormInput } from "@/lib/validation/media-input";
import type { MediaFormInput } from "@/types/media";

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

/**
 * Plays recorded so far for a set of ok.ru videos, keyed by embed url.
 *
 * The counter lives on the episode row, but saving a collection replaces every
 * one of those rows, so the count has to be carried over by what identifies the
 * video itself — its ok.ru URL. Looked up across the whole table, not just one
 * collection, so a video pulled in from a sibling collection arrives with its
 * views. (`save_media_item` does the same inside its transaction; this one is
 * for the moves that happen outside it.)
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

export interface WriteOptions {
  /** Creation date for a NEW row — only the demo seed sets it. Ignored on update. */
  createdAt?: string;
}

/**
 * Creates or updates a collection and replaces its episode list. Episodes
 * marked as claimed from another collection are deleted there afterwards, so
 * the same ok.ru video never lives in two collections.
 *
 * The input is validated first (lib/validation/media-input.ts) — it arrives
 * from a Server Action, so nothing about its shape can be assumed — and then
 * the whole write is a single call to `save_media_item` (supabase/schema.sql),
 * which runs in one transaction: either every step lands, or none does. It
 * used to be several requests in a row, and a failure between deleting the old
 * episodes and inserting the new ones left the collection empty.
 */
export async function writeMediaItem(
  supabase: SupabaseClient,
  rawInput: MediaFormInput,
  options: WriteOptions = {}
): Promise<WriteResult> {
  const parsed = parseMediaFormInput(rawInput);
  if (parsed.error !== undefined) return { error: parsed.error };
  const input = parsed.data;

  // Kept derived rather than hand-entered so the range can never drift from
  // the episodes it summarises. Single-video collections have no episodes to
  // derive it from, so they carry the date themselves.
  const [firstStreamedAt, lastStreamedAt] =
    input.episodes.length > 0
      ? streamRangeOf(input.episodes.map((episode) => episode.streamedAt))
      : streamRangeOf([input.streamedAt]);

  const item: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    type: input.type,
    poster_url: input.posterUrl,
    genres: input.genres,
    year: input.year ?? null,
    description: input.description ?? null,
    duration: input.duration ?? null,
    okru_embed_url: input.okRuEmbedUrl ?? null,
    status: input.status ?? null,
    rating: input.rating ?? null,
    published: input.published,
    first_streamed_at: firstStreamedAt,
    last_streamed_at: lastStreamedAt,
  };

  if (!input.id && options.createdAt) item.created_at = options.createdAt;

  // Omitted (not nulled) when the caller doesn't manage the link, so a write
  // from a form that never loaded it can't wipe it — the SQL function only
  // touches the channel columns when this key is present.
  if (input.okruChannel !== undefined) {
    item.okru_channel_id = input.okruChannel?.id ?? null;
    item.okru_channel_name = input.okruChannel?.name ?? null;
    item.okru_channel_url = input.okruChannel?.url ?? null;
  }

  const episodes = input.episodes.map((episode) => ({
    episode_number: episode.episodeNumber,
    season_number: episode.seasonNumber ?? null,
    title: episode.title,
    okru_embed_url: episode.okRuEmbedUrl,
    duration: episode.duration ?? null,
    thumbnail_url: episode.thumbnailUrl ?? null,
    streamed_at: episode.streamedAt ?? null,
  }));

  const claimed = input.episodes
    .map((episode) => episode.claimedFromEpisodeId)
    .filter((id): id is string => Boolean(id));

  const { data, error } = await supabase.rpc("save_media_item", {
    p_id: input.id ?? null,
    p_item: item,
    p_episodes: episodes,
    p_claimed: claimed,
  });

  if (error) {
    // Until supabase/schema.sql is re-run the function does not exist; say so
    // instead of showing PostgREST's "could not find the function" jargon.
    if (error.code === "PGRST202") {
      return {
        error: "Falta la función save_media_item en Supabase: vuelve a ejecutar supabase/schema.sql.",
      };
    }
    return { error: describeWriteError(error) };
  }

  if (typeof data !== "string") return { error: "No se pudo guardar el título." };

  return { id: data };
}
