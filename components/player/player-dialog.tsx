"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor } from "lucide-react";

import { MediaPlayer } from "@/components/player/media-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/media";

/**
 * Preset player sizes. Each caps how much of the window height the picture may
 * take, and the modal is never wider than the 16:9 box that height allows —
 * otherwise a wide modal on a short screen would frame the video in black
 * bars. Only the `sm:` width is overridden so phones keep the default margin.
 */
const PLAYER_SIZES = {
  small: {
    label: "Pequeño",
    dialog: "sm:max-w-[min(48rem,calc(45vh*16/9))]",
    video: "max-h-[45vh] max-w-[calc(45vh*16/9)]",
  },
  medium: {
    label: "Mediano",
    dialog: "sm:max-w-[min(64rem,calc(58vh*16/9))]",
    video: "max-h-[58vh] max-w-[calc(58vh*16/9)]",
  },
  large: {
    label: "Grande",
    dialog: "sm:max-w-[min(80rem,calc(70vh*16/9))]",
    video: "max-h-[70vh] max-w-[calc(70vh*16/9)]",
  },
  full: {
    label: "Pantalla completa",
    dialog: "sm:max-w-[min(98vw,calc(80vh*16/9))]",
    video: "max-h-[80vh] max-w-[calc(80vh*16/9)]",
  },
} as const;

type PlayerSize = keyof typeof PLAYER_SIZES;

const SIZE_ORDER = Object.keys(PLAYER_SIZES) as PlayerSize[];
const DEFAULT_SIZE: PlayerSize = "medium";
/** Remembered across titles: picking a size is a viewing preference, not a per-video one. */
const SIZE_STORAGE_KEY = "novagiv:player-size";

function isPlayerSize(value: string | null): value is PlayerSize {
  return value !== null && value in PLAYER_SIZES;
}

/** Safe on the server, where the dialog's portal renders nothing anyway. */
function readStoredSize(): PlayerSize {
  if (typeof window === "undefined") return DEFAULT_SIZE;
  const stored = window.localStorage.getItem(SIZE_STORAGE_KEY);
  return isPlayerSize(stored) ? stored : DEFAULT_SIZE;
}

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
  const [size, setSize] = useState<PlayerSize>(readStoredSize);
  const contentRef = useRef<HTMLDivElement>(null);

  function changeSize(next: PlayerSize) {
    setSize(next);
    window.localStorage.setItem(SIZE_STORAGE_KEY, next);
  }

  const sizePreset = PLAYER_SIZES[size];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) router.back();
      }}
    >
      <DialogContent
        className={cn("gap-0 overflow-hidden p-0", sizePreset.dialog)}
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
            headerActions={<PlayerSizeMenu size={size} onChange={changeSize} />}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Preset sizes for the picture, remembered for the next video. */
function PlayerSizeMenu({
  size,
  onChange,
}: {
  size: PlayerSize;
  onChange: (size: PlayerSize) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="shrink-0" aria-label="Tamaño del video" />
        }
      >
        <Monitor className="size-4" />
        <span className="hidden sm:inline">{PLAYER_SIZES[size].label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={size}
          onValueChange={(value) => onChange(value as PlayerSize)}
        >
          {SIZE_ORDER.map((option) => (
            // Radio items keep the menu open by default; picking a size is a
            // one-shot choice, so get out of the way of the video.
            <DropdownMenuRadioItem key={option} value={option} closeOnClick>
              {PLAYER_SIZES[option].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
