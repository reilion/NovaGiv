import { PlayerDialog } from "@/components/player/player-dialog";
import { loadMediaView } from "@/lib/media-view";

interface MediaModalProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ep?: string }>;
}

/**
 * Intercepts /v/[slug] when it is reached from inside the app — a card in the
 * catalog — and renders the player as a dialog over whatever was on screen,
 * which is how this site has always opened a video.
 *
 * The URL is the real one either way, so the link is shareable and the back
 * button closes the player. Reloading it, or opening it from outside, falls
 * through to app/v/[slug]/page.tsx and renders the full page instead.
 */
export default async function MediaModal({ params, searchParams }: MediaModalProps) {
  const [{ slug }, { ep }] = await Promise.all([params, searchParams]);
  const { item, likedVideoIds, initialEpisodeId } = await loadMediaView(slug, ep);

  return (
    <PlayerDialog
      item={item}
      likedVideoIds={likedVideoIds}
      initialEpisodeId={initialEpisodeId}
    />
  );
}
