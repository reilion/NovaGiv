"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeFromWatchLater } from "@/lib/actions/watch-later";

/**
 * Takes one video off "Ver después". The server action revalidates the list,
 * so the row leaves it without this having to track anything locally.
 */
export function RemoveFromWatchLaterButton({
  mediaItemId,
  episodeRef,
  title,
}: {
  mediaItemId: string;
  /** The saved episode's "12" / "2x12"; omitted for a collection's own video. */
  episodeRef?: string;
  title: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      disabled={isPending}
      aria-label={`Quitar «${title}» de Ver después`}
      title={error ?? "Quitar de Ver después"}
      onClick={() =>
        startTransition(async () => {
          const result = await removeFromWatchLater(mediaItemId, episodeRef);
          setError(result.error ?? null);
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}
