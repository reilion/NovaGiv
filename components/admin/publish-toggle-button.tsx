"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { togglePublished } from "@/lib/actions/media";
import { cn } from "@/lib/utils";

export function PublishToggleButton({ id, published }: { id: string; published: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await togglePublished(id, !published);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <button type="button" onClick={handleClick} disabled={isPending} className="cursor-pointer">
        <Badge
          variant={published ? "default" : "outline"}
          className={cn(!published && "text-muted-foreground", isPending && "opacity-60")}
        >
          {published ? "Publicado" : "Borrador"}
        </Badge>
      </button>
    </div>
  );
}
