"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface WatchLaterResult {
  saved: boolean;
  /** Set when nothing changed, so the button can put its old state back. */
  error?: string;
}

/**
 * Puts one video on the account's "Ver después" list, or takes it off, and
 * answers with the state the button should settle on.
 *
 * Goes through `toggle_watch_later` rather than an insert from here: the table
 * has no insert policy, because the function is what turns the episode id into
 * the "12" / "2x12" ref the row is keyed by (see supabase/schema.sql).
 *
 * `episodeId` omitted = the collection's own video (movie, karaoke, especial).
 */
export async function toggleWatchLater(
  mediaItemId: string,
  episodeId?: string
): Promise<WatchLaterResult> {
  if (!isSupabaseConfigured) {
    return { saved: false, error: "El catálogo todavía no está conectado." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_watch_later", {
    p_media_item_id: mediaItemId,
    p_episode_id: episodeId ?? null,
  });

  if (error || typeof data !== "boolean") {
    console.error("toggleWatchLater error —", error?.message);

    return {
      saved: false,
      error:
        error?.code === "42501"
          ? "Inicia sesión otra vez para guardar videos."
          : "No pudimos actualizar tu lista.",
    };
  }

  // Nothing revalidated, the same as for likes: the catalog behind the player
  // has nothing that depends on this, and /ver-despues is rendered per request.
  return { saved: data };
}

/**
 * Takes one video off the list from /ver-despues. A delete rather than the
 * toggle above, so a row already removed from another tab stays removed instead
 * of coming back.
 *
 * No user filter: the delete policy already limits a session to its own rows.
 */
export async function removeFromWatchLater(
  mediaItemId: string,
  episodeRef?: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "El catálogo todavía no está conectado." };

  const supabase = await createClient();
  const query = supabase.from("watch_later").delete().eq("media_item_id", mediaItemId);
  const { error } = await (episodeRef
    ? query.eq("episode_ref", episodeRef)
    : query.is("episode_ref", null));

  if (error) {
    console.error("removeFromWatchLater error —", error.message);
    return { error: "No pudimos quitarlo de la lista." };
  }

  revalidatePath("/ver-despues");

  return {};
}
