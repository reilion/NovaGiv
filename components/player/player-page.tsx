"use client";

import type { ReactNode } from "react";

import { MediaPlayer } from "@/components/player/media-player";
import { PLAYER_SIZES, PlayerSizeMenu, usePlayerSize } from "@/components/player/player-size";
import { cn } from "@/lib/utils";
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
 * The player on its own page, with the same size menu as the dialog: the column
 * widens with the size picked, the way the modal does.
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
    <div className={cn("mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8", sizePreset.width)}>
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
