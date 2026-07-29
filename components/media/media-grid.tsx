import { SearchX } from "lucide-react";

import { MediaCard } from "@/components/media/media-card";
import type { SearchParamsRecord } from "@/lib/url";
import type { MediaItem } from "@/types/media";

interface MediaGridProps {
  items: MediaItem[];
  currentParams: SearchParamsRecord;
}

export function MediaGrid({ items, currentParams }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <SearchX className="size-8 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Sin resultados</p>
        <p className="text-sm text-muted-foreground">
          Prueba con otro título, género o categoría.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} currentParams={currentParams} />
      ))}
    </div>
  );
}
