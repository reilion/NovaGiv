"use client";

import { useSyncExternalStore } from "react";
import { Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Preset player sizes, shared by the dialog and the /v/[slug] page. Each caps
 * how much of the window height the picture may take, and whatever frames it
 * (the modal, the page column) is never wider than the 16:9 box that height
 * allows — otherwise a wide frame on a short screen would put the video between
 * black bars. Only the `sm:` width is set so phones keep their own margins.
 */
export const PLAYER_SIZES = {
  small: {
    label: "Pequeño",
    width: "sm:max-w-[min(48rem,calc(45vh*16/9))]",
    video: "max-h-[45vh] max-w-[calc(45vh*16/9)]",
  },
  medium: {
    label: "Mediano",
    width: "sm:max-w-[min(64rem,calc(58vh*16/9))]",
    video: "max-h-[58vh] max-w-[calc(58vh*16/9)]",
  },
  large: {
    label: "Grande",
    width: "sm:max-w-[min(80rem,calc(70vh*16/9))]",
    video: "max-h-[70vh] max-w-[calc(70vh*16/9)]",
  },
  full: {
    label: "Pantalla completa",
    width: "sm:max-w-[min(98vw,calc(80vh*16/9))]",
    video: "max-h-[80vh] max-w-[calc(80vh*16/9)]",
  },
} as const;

export type PlayerSize = keyof typeof PLAYER_SIZES;

const SIZE_ORDER = Object.keys(PLAYER_SIZES) as PlayerSize[];
const DEFAULT_SIZE: PlayerSize = "medium";
/** Remembered across titles: picking a size is a viewing preference, not a per-video one. */
const SIZE_STORAGE_KEY = "novagiv:player-size";

function isPlayerSize(value: string | null): value is PlayerSize {
  return value !== null && value in PLAYER_SIZES;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab picking a size moves this one along too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStoredSize(): PlayerSize {
  try {
    const stored = window.localStorage.getItem(SIZE_STORAGE_KEY);
    return isPlayerSize(stored) ? stored : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

function storeSize(size: PlayerSize) {
  try {
    window.localStorage.setItem(SIZE_STORAGE_KEY, size);
  } catch {
    // Storage blocked: the size still changes, it just isn't remembered.
  }
  listeners.forEach((listener) => listener());
}

/**
 * The size the viewer picked. An external store rather than state read once:
 * the page renders on the server, which can't see localStorage, so it starts on
 * the default and moves to the stored size right after hydration instead of
 * mismatching.
 */
export function usePlayerSize(): [PlayerSize, (size: PlayerSize) => void] {
  const size = useSyncExternalStore(subscribe, readStoredSize, () => DEFAULT_SIZE);
  return [size, storeSize];
}

/** Preset sizes for the picture, remembered for the next video. */
export function PlayerSizeMenu({
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
