"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeFromHistory } from "@/lib/actions/history";

/**
 * Takes one collection out of the history — and out of "Seguir viendo", which
 * reads the same rows. The server action revalidates both, so the row leaves
 * the list without this having to track anything locally.
 */
export function RemoveFromHistoryButton({
  mediaItemId,
  title,
}: {
  mediaItemId: string;
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
      aria-label={`Quitar «${title}» del historial`}
      title={error ?? "Quitar del historial"}
      onClick={() =>
        startTransition(async () => {
          const result = await removeFromHistory(mediaItemId);
          setError(result.error ?? null);
        })
      }
    >
      <X className="size-4" />
    </Button>
  );
}
