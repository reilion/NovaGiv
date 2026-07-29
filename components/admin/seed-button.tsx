"use client";

import { useState, useTransition } from "react";
import { Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { seedMockData } from "@/lib/actions/media";

export function SeedButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await seedMockData();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
        <Sprout className="size-4" />
        {isPending ? "Sembrando…" : "Sembrar datos de ejemplo"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
