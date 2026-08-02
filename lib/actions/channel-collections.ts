"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminClient } from "@/lib/actions/require-admin";
import { writeMediaItem } from "@/lib/media-write";
import { slugify } from "@/lib/text";
import { isEpisodic, type EpisodeInput, type MediaFormInput, type MediaType } from "@/types/media";

/**
 * A single ok.ru channel often mixes unrelated content (a couple of movies, a
 * series, one-off streams). These actions let the admin break that one
 * imported collection into several — each keeping the channel reference, so
 * `pnpm okru:sync` still knows where every video came from and never imports
 * it twice.
 */

export interface ChannelSiblingEpisode {
  id: string;
  episodeNumber: number;
  seasonNumber?: number;
  title: string;
  okRuEmbedUrl: string;
  duration?: string;
  thumbnailUrl?: string;
  streamedAt?: string;
}

export interface ChannelSibling {
  id: string;
  title: string;
  type: MediaType;
  published: boolean;
  /** The collection `pnpm okru:sync` appends the channel's new videos to. */
  isPrimary: boolean;
  episodes: ChannelSiblingEpisode[];
}

export interface ChannelSiblingsResult {
  collections?: ChannelSibling[];
  error?: string;
}

interface SiblingRow {
  id: string;
  title: string;
  type: MediaType;
  published: boolean;
  okru_channel_primary: boolean;
  episodes:
    | {
        id: string;
        episode_number: number;
        season_number: number | null;
        title: string;
        okru_embed_url: string;
        duration: string | null;
        thumbnail_url: string | null;
        streamed_at: string | null;
      }[]
    | null;
}

/**
 * The other collections built from the same channel, with the episodes they
 * hold — the pool a collection can pull videos from.
 */
export async function listChannelSiblings(
  mediaItemId: string,
  channelId: string
): Promise<ChannelSiblingsResult> {
  const supabase = await requireAdminClient();

  if (!channelId) {
    return { error: "Esta colección no está vinculada a ningún canal de ok.ru." };
  }

  const { data, error } = await supabase
    .from("media_items")
    .select("id, title, type, published, okru_channel_primary, episodes(*)")
    .eq("okru_channel_id", channelId)
    .neq("id", mediaItemId)
    .order("title");

  if (error) return { error: error.message };

  const collections = (data as SiblingRow[])
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      published: row.published,
      isPrimary: row.okru_channel_primary,
      episodes: (row.episodes ?? [])
        .map((episode) => ({
          id: episode.id,
          episodeNumber: episode.episode_number,
          seasonNumber: episode.season_number ?? undefined,
          title: episode.title,
          okRuEmbedUrl: episode.okru_embed_url,
          duration: episode.duration ?? undefined,
          thumbnailUrl: episode.thumbnail_url ?? undefined,
          streamedAt: episode.streamed_at ?? undefined,
        }))
        .sort(
          (a, b) =>
            (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || a.episodeNumber - b.episodeNumber
        ),
    }))
    // Nothing to offer from a collection whose video lives on the item itself
    // (a movie), so it would only be noise in the picker.
    .filter((collection) => collection.episodes.length > 0);

  return { collections };
}

/** "13 julio 2024" twice in a channel is normal, so the slug gets a suffix instead of failing. */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof requireAdminClient>>,
  base: string
): Promise<string> {
  const root = base || "coleccion";
  const { data } = await supabase.from("media_items").select("slug").like("slug", `${root}%`);
  const taken = new Set((data ?? []).map((row) => row.slug as string));

  if (!taken.has(root)) return root;
  for (let suffix = 2; suffix < 500; suffix++) {
    if (!taken.has(`${root}-${suffix}`)) return `${root}-${suffix}`;
  }
  return `${root}-${Date.now()}`;
}

export interface ExtractEpisodeInput {
  /** The collection as it stands in the form, unsaved edits included. */
  source: MediaFormInput;
  /** Index into `source.episodes` of the episode that moves out. */
  episodeIndex: number;
  title: string;
  type: MediaType;
}

export interface ExtractResult {
  error?: string;
}

/**
 * Moves one episode into a brand-new collection of its own — the usual case
 * being a movie sitting in a channel full of unrelated streams. Saves the
 * source collection too (the form's pending edits included) so the video ends
 * up in exactly one place, and lands on the new collection's edit page.
 */
export async function extractEpisodeToCollection(
  input: ExtractEpisodeInput
): Promise<ExtractResult> {
  const supabase = await requireAdminClient();

  if (!input.source.id) {
    return { error: "Guarda esta colección antes de extraer episodios." };
  }

  const episode = input.source.episodes[input.episodeIndex];
  if (!episode) return { error: "Ese episodio ya no existe en la lista." };

  const title = input.title.trim();
  if (!title) return { error: "La nueva colección necesita un título." };
  if (input.source.episodes.length < 2) {
    return {
      error:
        "Es el único episodio de la colección: cambia el tipo de esta colección en vez de extraerlo.",
    };
  }

  const episodic = isEpisodic(input.type);
  const carried: EpisodeInput = {
    ...episode,
    seasonNumber: undefined,
    episodeNumber: 1,
  };

  // The new collection first: it holds the only copy of the video for a
  // moment, and its slug is what can realistically clash.
  const created = await writeMediaItem(supabase, {
    title,
    slug: await uniqueSlug(supabase, slugify(title)),
    type: input.type,
    posterUrl: episode.thumbnailUrl?.trim() || input.source.posterUrl,
    genres: [],
    // Same channel, so `pnpm okru:sync` keeps recognising where it came from
    // and won't re-import the video into the source collection.
    okruChannel: input.source.okruChannel ?? undefined,
    published: false,
    status: episodic ? "ongoing" : undefined,
    duration: episodic ? undefined : episode.duration,
    okRuEmbedUrl: episodic ? undefined : episode.okRuEmbedUrl,
    // A movie keeps the date of the stream it came from, which for an episodic
    // collection would come from its episodes.
    streamedAt: episodic ? undefined : episode.streamedAt,
    episodes: episodic ? [carried] : [],
  });

  if (created.error || !created.id) {
    return { error: created.error ?? "No se pudo crear la colección." };
  }

  // A non-episodic collection stores the video on the item itself, so the
  // claim has to be released here instead of through an episode row.
  if (!episodic && episode.claimedFromEpisodeId) {
    await supabase.from("episodes").delete().eq("id", episode.claimedFromEpisodeId);
  }

  const remaining = input.source.episodes.filter((_, index) => index !== input.episodeIndex);
  const saved = await writeMediaItem(supabase, { ...input.source, episodes: remaining });

  if (saved.error) {
    return {
      error:
        `Se creó "${title}", pero no se pudo guardar la colección de origen: ${saved.error}. ` +
        "Vuelve a guardarla para quitar el episodio duplicado.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/media/${created.id}`);
}
