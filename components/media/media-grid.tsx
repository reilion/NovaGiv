import { SearchX } from "lucide-react";

import { MediaCard } from "@/components/media/media-card";
import type { YearGroup } from "@/lib/media-filter";
import type { CatalogCard } from "@/types/media";

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export function MediaGrid({ items }: { items: CatalogCard[] }) {
  return (
    <div className={`${GRID_CLASS} py-6`}>
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </div>
  );
}

interface MediaGridByYearProps {
  groups: YearGroup<CatalogCard>[];
  /**
   * How many collections each year holds across the whole result, from the
   * catalog query. Without it a heading would count the cards loaded so far and
   * grow as the scroll went on — it is a section's size, not its progress.
   */
  counts: Map<number | null, number>;
}

/** Default view: one section per stream year, with undated items last. */
export function MediaGridByYear({ groups, counts }: MediaGridByYearProps) {
  return (
    <div className="flex flex-col gap-8 py-6">
      {groups.map((group) => {
        const total = counts.get(group.year) ?? group.items.length;

        return (
          <section key={group.year ?? "undated"} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {group.year ?? "Sin fecha"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {total} {total === 1 ? "colección" : "colecciones"}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <div className={GRID_CLASS}>
              {group.items.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function EmptyState() {
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
