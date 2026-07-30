import { SearchX } from "lucide-react";

import { MediaCard } from "@/components/media/media-card";
import type { YearGroup } from "@/lib/media-filter";
import type { SearchParamsRecord } from "@/lib/url";
import type { MediaItem } from "@/types/media";

interface MediaGridProps {
  items: MediaItem[];
  currentParams: SearchParamsRecord;
}

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export function MediaGrid({ items, currentParams }: MediaGridProps) {
  if (items.length === 0) return <EmptyState />;

  return (
    <div className={`${GRID_CLASS} py-6`}>
      {items.map((item) => (
        <MediaCard key={item.id} item={item} currentParams={currentParams} />
      ))}
    </div>
  );
}

/** Default view: one section per stream year, with undated items last. */
export function MediaGridByYear({
  groups,
  currentParams,
}: {
  groups: YearGroup[];
  currentParams: SearchParamsRecord;
}) {
  if (groups.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-8 py-6">
      {groups.map((group) => (
        <section key={group.year ?? "undated"} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {group.year ?? "Sin fecha"}
            </h2>
            <span className="text-xs text-muted-foreground">
              {group.items.length} {group.items.length === 1 ? "colección" : "colecciones"}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <div className={GRID_CLASS}>
            {group.items.map((item) => (
              <MediaCard key={item.id} item={item} currentParams={currentParams} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <SearchX className="size-8 text-muted-foreground" />
      <p className="text-lg font-medium text-foreground">Sin resultados</p>
      <p className="text-sm text-muted-foreground">
        Prueba con otro título, género, categoría o rango de fechas.
      </p>
    </div>
  );
}
