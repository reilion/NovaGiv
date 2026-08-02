"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminClient } from "@/lib/actions/require-admin";
import { writeMediaItem } from "@/lib/media-write";
import { MOCK_MEDIA } from "@/lib/mock-data";
import type { MediaFormInput } from "@/types/media";

export interface ActionResult {
  error?: string;
}

export async function upsertMediaItem(input: MediaFormInput): Promise<ActionResult> {
  const supabase = await requireAdminClient();

  const result = await writeMediaItem(supabase, input);
  if (result.error) return { error: result.error };

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
