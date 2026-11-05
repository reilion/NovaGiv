"use client";

import type { ReactNode } from "react";

import { MediaPlayer } from "@/components/player/media-player";
import { PLAYER_SIZES, PlayerSizeMenu, usePlayerSize } from "@/components/player/player-size";
import type { MediaItem } from "@/types/media";

interface PlayerPageProps {
  item: MediaItem;
  likedVideoIds: string[] | null;
  savedVideoIds: string[] | null;
  initialEpisodeId?: string;
  /** What sits above the player — kept in the same column so both line up. */
  toolbar: ReactNode;
}

/**
 * The player on its own page, with the same size menu as the dialog. The page
 * keeps its full width — details and the episode list sit side by side under
 * the picture — and the size picked caps the picture itself, letterboxed on the
 * black stage.
 */
export function PlayerPage({
  item,
  likedVideoIds,
  savedVideoIds,
  initialEpisodeId,
  toolbar,
}: PlayerPageProps) {
  const [size, setSize] = usePlayerSize();
  const sizePreset = PLAYER_SIZES[size];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {toolbar}

      <MediaPlayer
        item={item}
        likedVideoIds={likedVideoIds}
        savedVideoIds={savedVideoIds}
        initialEpisodeId={initialEpisodeId}
        variant="page"
        videoClassName={sizePreset.video}
        headerActions={<PlayerSizeMenu size={size} onChange={setSize} />}
      />
    </div>
  );
}
