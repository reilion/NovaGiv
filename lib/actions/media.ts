"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminClient } from "@/lib/actions/require-admin";
import { MOCK_MEDIA } from "@/lib/mock-data";
import { toOkRuEmbedUrl } from "@/lib/okru";
import type { MediaStatus, MediaType } from "@/types/media";

export interface EpisodeInput {
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  okRuEmbedUrl: string;
  duration?: string;
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
}

export interface ActionResult {
  error?: string;
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
  };

  let mediaItemId = input.id;

  if (mediaItemId) {
    const { error } = await supabase.from("media_items").update(row).eq("id", mediaItemId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("media_items")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "No se pudo crear el título." };
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
      }));
      const { error } = await supabase.from("episodes").insert(episodeRows);
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}
