"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminClient } from "@/lib/auth";
import { writeMediaItem } from "@/lib/media-write";
import { MOCK_MEDIA } from "@/lib/mock-data";
import { isUuid } from "@/lib/validation/ids";
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
  if (!isUuid(id)) return { error: "Id de colección no válido." };

  const { error } = await supabase.from("media_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}

export async function togglePublished(id: string, published: boolean): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!isUuid(id) || typeof published !== "boolean") return { error: "Datos no válidos." };

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

    // Through the same validated, transactional write as the admin form, so a
    // re-seed that fails half-way cannot leave a title without its episodes.
    // Counters are carried over by ok.ru URL inside it, as on any save.
    const result = await writeMediaItem(
      supabase,
      {
        id: (existing?.id as string | undefined) ?? undefined,
        title: item.title,
        slug: item.slug,
        type: item.type,
        posterUrl: item.posterUrl,
        genres: item.genres,
        year: item.year,
        description: item.description,
        duration: item.duration,
        okRuEmbedUrl: item.okRuEmbedUrl,
        status: item.status,
        rating: item.rating,
        published: item.published !== false,
        streamedAt: item.lastStreamedAt,
        episodes: (item.episodes ?? []).map((episode) => ({
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          title: episode.title,
          okRuEmbedUrl: episode.okRuEmbedUrl,
          duration: episode.duration,
          streamedAt: episode.streamedAt,
        })),
      },
      { createdAt: item.createdAt }
    );

    if (result.error) return { error: `"${item.title}": ${result.error}` };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return {};
}
