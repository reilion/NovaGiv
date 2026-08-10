"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/queries";

/**
 * Counts one play. Called by the player when a video is shown — ok.ru's iframe
 * never tells us whether it was actually watched, so "opened in the player" is
 * what a view means here. The client only fires it once per video per session
 * (see components/player/video-player-modal.tsx), so re-opening the same
 * episode while browsing doesn't inflate the count.
 *
 * Goes through the `register_video_view` function instead of an update: the
 * public site is anonymous, and RLS lets it read the catalog but not write to
 * it. The function is the one narrow exception (see supabase/schema.sql).
 *
 * `episodeId` omitted = the collection's own video (movie, karaoke, especial).
 */
export async function registerVideoView(mediaItemId: string, episodeId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_video_view", {
    p_media_item_id: mediaItemId,
    p_episode_id: episodeId ?? null,
  });

  // A lost view is not worth failing the page over — the video is already playing.
  if (error) console.error("registerVideoView error —", error.message);
}
