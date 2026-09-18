"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { toggleWatchLater } from "@/lib/actions/watch-later";
import { loginPath } from "@/lib/url";
import { cn } from "@/lib/utils";

interface WatchLaterButtonProps {
  mediaItemId: string;
  /** Omitted for a collection's own video: a movie, karaoke or especial. */
  episodeId?: string;
  saved: boolean;
  /** False while nobody is signed in — the button turns into a way to do that. */
  canSave: boolean;
}

/**
 * Puts the video currently playing on the "Ver después" list. Keyed by that
 * video's id in the player, like the like button beside it, so switching
 * episodes gets a button that starts from the new video's own state.
 */
export function WatchLaterButton({ mediaItemId, episodeId, saved, canSave }: WatchLaterButtonProps) {
  const [isSaved, setIsSaved] = useState(saved);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!canSave) {
    // Back to this very video once they are in, the same as the like button.
    const query = searchParams.toString();
    const href = loginPath(query ? `${pathname}?${query}` : pathname);

    return (
      <Link
        href={href}
        title="Inicia sesión para guardar videos"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
      >
        <Bookmark className="size-4" />
        <span className="hidden sm:inline">Ver después</span>
      </Link>
    );
  }

  function toggle() {
    const previous = isSaved;

    // Flipped before the round trip, for the same reason as a like.
    setIsSaved(!previous);
    setError(null);

    startTransition(async () => {
      const result = await toggleWatchLater(mediaItemId, episodeId);

      if (result.error) {
        setIsSaved(previous);
        setError(result.error);
        return;
      }

      setIsSaved(result.saved);
    });
  }

  const Icon = isSaved ? BookmarkCheck : Bookmark;

  return (
    <Button
      type="button"
      onClick={toggle}
      disabled={isPending}
      variant={isSaved ? "secondary" : "outline"}
      size="sm"
      className={cn("shrink-0", isSaved && "text-primary")}
      aria-pressed={isSaved}
      // Without the visible label on a phone, this is what says what it does.
      aria-label="Ver después"
      title={error ?? (isSaved ? "En tu lista de Ver después — quitar" : "Guardar para ver después")}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">Ver después</span>
    </Button>
  );
}
