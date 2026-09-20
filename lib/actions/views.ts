"use server";

import { headers } from "next/headers";

import { rateLimit, type RateLimitRule } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Plays one address may count. The player already refuses to count the same
 * video twice in a browsing session, so reaching this at all takes forty
 * different videos in ten minutes — more than an evening of watching, and far
 * less than a loop worth running.
 *
 * Nothing here is keyed to the video: a limit per video would only push
 * somebody wanting to inflate one counter into spreading the calls, and would
 * punish a household or an office sharing one address for watching the same
 * thing. Capping the caller is the shape that fits.
 */
const VIEWS_PER_IP: RateLimitRule = { limit: 40, windowMs: 10 * 60_000 };

/** Anything else never named a row, so it is a probe, not a play. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Counts one play. Called by the player when a video is shown — ok.ru's iframe
 * never tells us whether it was actually watched, so "opened in the player" is
 * what a view means here. The client only fires it once per video per session
 * (see components/player/media-player.tsx), so re-opening the same
 * episode while browsing doesn't inflate the count.
 *
 * That guard lives in the browser, though, which makes it a convenience and not
 * a rule — this is a public endpoint, and anything public gets called directly
 * sooner or later. Hence the budget below: the counters are the one number on
 * the site anybody has a reason to forge.
 *
 * Goes through the `register_video_view` function instead of an update: the
 * public site is anonymous, and RLS lets it read the catalog but not write to
 * it. The function is the one narrow exception (see supabase/schema.sql).
 *
 * `episodeId` omitted = the collection's own video (movie, karaoke, especial).
 */
export async function registerVideoView(mediaItemId: string, episodeId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  // Before the budget, not after: a malformed id is somebody poking at the
  // endpoint, and it should cost them the call rather than cost a real viewer
  // room in a shared one.
  if (!UUID.test(mediaItemId)) return;
  if (episodeId !== undefined && !UUID.test(episodeId)) return;

  const address = clientIp(await headers());
  if (address && !rateLimit(`views:ip:${address}`, VIEWS_PER_IP).allowed) {
    // Silently. There is nothing for the player to do about it — the video is
    // already playing — and an error would only tell whoever is looping this
    // exactly where the limit sits.
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_video_view", {
    p_media_item_id: mediaItemId,
    p_episode_id: episodeId ?? null,
  });

  // A lost view is not worth failing the page over — the video is already playing.
  if (error) console.error("registerVideoView error —", error.message);
}
