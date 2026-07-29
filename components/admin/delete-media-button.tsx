"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteMediaItem } from "@/lib/actions/media";

export function DeleteMediaButton({ id, title }: { id: string; title: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteMediaItem(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={isPending}
        aria-label={`Eliminar ${title}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
