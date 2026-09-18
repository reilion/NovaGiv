"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface LikeResult {
  liked: boolean;
  likes: number;
  /** Set when nothing changed, so the button can put its old state back. */
  error?: string;
}

/**
 * Adds or removes the signed-in account's like on one video, and answers with
 * the state the button should settle on.
 *
 * Goes through the `toggle_video_like` function rather than an insert and a
 * delete from here: it decides which of the two applies and reads the new total
 * inside one transaction, so two people liking at the same moment cannot hand
 * each other a stale count (see supabase/schema.sql).
 *
 * Unlike a view, this is never anonymous — a like nobody owns could not be
 * taken back, and would be counted again from the next browser.
 *
 * `episodeId` omitted = the collection's own video (movie, karaoke, especial).
 */
export async function toggleVideoLike(
  mediaItemId: string,
  episodeId?: string
): Promise<LikeResult> {
  if (!isSupabaseConfigured) {
    return { liked: false, likes: 0, error: "El catálogo todavía no está conectado." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("toggle_video_like", {
      p_media_item_id: mediaItemId,
      p_episode_id: episodeId ?? null,
    })
    .maybeSingle<{ liked: boolean; likes: number }>();

  if (error || !data) {
    console.error("toggleVideoLike error —", error?.message);

    // 42501 is what the function raises when there is no session: the cookie
    // expired while the modal sat open.
    return {
      liked: false,
      likes: 0,
      error:
        error?.code === "42501"
          ? "Inicia sesión otra vez para dar me gusta."
          : "No pudimos guardar tu me gusta.",
    };
  }

  // The catalog is not revalidated on purpose, the same as for views: the grid
  // behind the player would re-render mid-click to move one number. The totals
  // on the cards catch up on the next load.
  return { liked: data.liked, likes: data.likes };
}
