"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

import { MediaPlayer } from "@/components/player/media-player";
import { PLAYER_SIZES, PlayerSizeMenu, usePlayerSize } from "@/components/player/player-size";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/media";

interface PlayerDialogProps {
  item: MediaItem;
  likedVideoIds: string[] | null;
  savedVideoIds: string[] | null;
  initialEpisodeId?: string;
}

/**
 * The player as a dialog over the catalog. Rendered by the route that
 * intercepts /v/[slug] (app/@modal), so the address bar already says which
 * title is open: being mounted *is* being open, and closing is a step back in
 * history to whatever the catalog was showing — filters, scroll position and
 * all.
 *
 * Opening the same URL cold (a shared link, a reload) skips this entirely and
 * renders app/v/[slug]/page.tsx as a full page.
 */
export function PlayerDialog({
  item,
  likedVideoIds,
  savedVideoIds,
  initialEpisodeId,
}: PlayerDialogProps) {
  const router = useRouter();
  const [size, setSize] = usePlayerSize();
  const contentRef = useRef<HTMLDivElement>(null);

  const sizePreset = PLAYER_SIZES[size];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) router.back();
      }}
    >
      <DialogContent
        className={cn("gap-0 overflow-hidden p-0", sizePreset.width)}
        showCloseButton
        // Without this, focus lands on the first tabbable element — which is
        // the ok.ru iframe. Every key from then on, Escape included, belongs to
        // a cross-origin document that never tells us about it, so the dialog
        // could not be closed from the keyboard at all.
        initialFocus={contentRef}
      >
        <div ref={contentRef} tabIndex={-1} className="outline-none">
          {/* The visible title lives inside MediaPlayer, which also renders on
              a page with no dialog around it. This is what labels the dialog
              for a screen reader. */}
          <DialogTitle className="sr-only">{item.title}</DialogTitle>

          <MediaPlayer
            item={item}
            likedVideoIds={likedVideoIds}
            savedVideoIds={savedVideoIds}
            initialEpisodeId={initialEpisodeId}
            variant="modal"
            videoClassName={sizePreset.video}
            headerActions={<PlayerSizeMenu size={size} onChange={setSize} />}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

