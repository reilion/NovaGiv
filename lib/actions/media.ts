"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminClient } from "@/lib/actions/require-admin";
import { MOCK_MEDIA } from "@/lib/mock-data";
import { toOkRuEmbedUrl } from "@/lib/okru";
import type { MediaStatus, MediaType, OkRuChannelRef } from "@/types/media";

export interface EpisodeInput {
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  okRuEmbedUrl: string;
  duration?: string;
  /** "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS"; drives the collection's date range. */
  streamedAt?: string;
}

export interface MediaFormInput {
  id?: string;
  title: string;
  slug: string;
  type: MediaType;
  posterUrl: string;
  genres: string[];
  year?: number;
  description?: string;
  duration?: string;
  okRuEmbedUrl?: string;
  status?: MediaStatus;
  rating?: number;
  /** Hidden from the public catalog while false — e.g. an ok.ru import awaiting review. */
  published: boolean;
  episodes: EpisodeInput[];
  /**
   * ok.ru channel this collection comes from. Persisted so `pnpm okru:sync`
   * can find the collection again after it has been renamed here. Null clears
   * the link; undefined leaves whatever is stored untouched.
   */
  okruChannel?: OkRuChannelRef | null;
}

export interface ActionResult {
  error?: string;
}

/** Turns Postgres' unique-violation jargon into something actionable in the form. */
function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code !== "23505") return error.message;
  if (error.message.includes("okru_channel_id")) {
    return "Ese canal de ok.ru ya está vinculado a otra colección. Desvincúlalo allí primero.";
  }
  if (error.message.includes("slug")) {
    return "Ya existe otro título con ese slug.";
  }
  return error.message;
}

export async function upsertMediaItem(input: MediaFormInput): Promise<ActionResult> {
  const supabase = await requireAdminClient();

  const title = input.title.trim();
  const slug = input.slug.trim();

  if (!title || !slug) {
    return { error: "Título y slug son obligatorios." };
  }
  if (!input.posterUrl.trim()) {
    return { error: "La URL del póster es obligatoria." };
  }

  // Kept derived rather than hand-entered so the range can never drift from
  // the episodes it summarises. Values are "YYYY-MM-DD..." strings, so
  // lexicographic comparison is chronological.
  const streamDates = input.episodes
    .map((episode) => episode.streamedAt?.trim())
    .filter((value): value is string => Boolean(value))
    .sort();

  const row = {
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
    first_streamed_at: streamDates[0] ?? null,
    last_streamed_at: streamDates[streamDates.length - 1] ?? null,
    // Omitted (not null) when the caller doesn't manage the link, so an update
    // from a form that never loaded it can't wipe it.
    ...(input.okruChannel === undefined
      ? {}
      : {
          okru_channel_id: input.okruChannel?.id ?? null,
          okru_channel_name: input.okruChannel?.name ?? null,
          okru_channel_url: input.okruChannel?.url ?? null,
        }),
  };

  let mediaItemId = input.id;

  if (mediaItemId) {
    const { error } = await supabase.from("media_items").update(row).eq("id", mediaItemId);
    if (error) return { error: describeWriteError(error) };
  } else {
    const { data, error } = await supabase
      .from("media_items")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return { error: error ? describeWriteError(error) : "No se pudo crear el título." };
    }
    mediaItemId = data.id as string;
  }

  // Simplest way to keep the episode list in sync with a dynamic admin form:
  // replace them all rather than diffing add/edit/remove individually.
  const { error: deleteError } = await supabase
    .from("episodes")
    .delete()
    .eq("media_item_id", mediaItemId);
  if (deleteError) return { error: deleteError.message };

  if (input.episodes.length > 0) {
    const episodeRows = input.episodes.map((episode) => ({
      media_item_id: mediaItemId,
      episode_number: episode.episodeNumber,
      season_number: episode.seasonNumber ?? null,
      title: episode.title.trim(),
      okru_embed_url: toOkRuEmbedUrl(episode.okRuEmbedUrl.trim()),
      duration: episode.duration?.trim() || null,
      streamed_at: episode.streamedAt?.trim() || null,
    }));
    const { error: episodesError } = await supabase.from("episodes").insert(episodeRows);
    if (episodesError) return { error: episodesError.message };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteMediaItem(id: string): Promise<ActionResult> {
  const supabase = await requireAdminClient();

  const { error } = await supabase.from("media_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}

export async function togglePublished(id: string, published: boolean): Promise<ActionResult> {
  const supabase = await requireAdminClient();

  const { error } = await supabase.from("media_items").update({ published }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}

/**
 * One-click import of lib/mock-data.ts into Supabase — lets the admin bring
 * over the demo catalog instead of retyping every title/episode by hand.
 * Upserts by slug, so it's safe to run more than once.
 */
export async function seedMockData(): Promise<ActionResult> {
  const supabase = await requireAdminClient();

  for (const item of MOCK_MEDIA) {
    const { data: existing, error: lookupError } = await supabase
      .from("media_items")
      .select("id")
      .eq("slug", item.slug)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };

    const row = {
      title: item.title,
      slug: item.slug,
      type: item.type,
      poster_url: item.posterUrl,
      genres: item.genres,
      year: item.year ?? null,
      description: item.description ?? null,
      duration: item.duration ?? null,
      okru_embed_url: item.okRuEmbedUrl ?? null,
      status: item.status ?? null,
      rating: item.rating ?? null,
      published: item.published !== false,
      first_streamed_at: item.firstStreamedAt ?? null,
      last_streamed_at: item.lastStreamedAt ?? null,
      created_at: item.createdAt,
    };

    let mediaItemId: string;

    if (existing) {
      mediaItemId = existing.id as string;
      const { error } = await supabase.from("media_items").update(row).eq("id", mediaItemId);
      if (error) return { error: error.message };
      await supabase.from("episodes").delete().eq("media_item_id", mediaItemId);
    } else {
      const { data, error } = await supabase
        .from("media_items")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) return { error: error?.message ?? `No se pudo crear "${item.title}".` };
      mediaItemId = data.id as string;
    }

    if (item.episodes?.length) {
      const episodeRows = item.episodes.map((episode) => ({
        media_item_id: mediaItemId,
        episode_number: episode.episodeNumber,
        season_number: episode.seasonNumber ?? null,
        title: episode.title,
        okru_embed_url: episode.okRuEmbedUrl,
        duration: episode.duration ?? null,
        streamed_at: episode.streamedAt ?? null,
      }));
      const { error } = await supabase.from("episodes").insert(episodeRows);
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}
