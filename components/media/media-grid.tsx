import { CalendarDays, SearchX } from "lucide-react";

import { MediaCard } from "@/components/media/media-card";
import type { YearGroup } from "@/lib/media-filter";
import type { CatalogCard } from "@/types/media";

const GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-5";

export function MediaGrid({ items }: { items: CatalogCard[] }) {
  return (
    <div className={`${GRID_CLASS} py-4 sm:py-8`}>
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
    <div className="flex flex-col gap-8 py-4 sm:gap-12 sm:py-8">
      {groups.map((group) => {
        const total = counts.get(group.year) ?? group.items.length;

        return (
          <section key={group.year ?? "undated"} className="flex flex-col gap-3 sm:gap-5">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3 shrink-0" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-primary/40 blur-[3px]" />
                <span className="relative size-3 rounded-full bg-primary" />
              </span>
              <CalendarDays className="hidden size-6 text-primary sm:block" aria-hidden />
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-2xl sm:font-bold">
                {group.year ? `Streams de ${group.year}` : "Sin fecha de stream"}
                <span className="font-semibold text-muted-foreground">
                  {" "}
                  — {total} {total === 1 ? "colección" : "colecciones"}
                </span>
              </h2>
              <span
                className="ml-2 hidden h-px flex-1 bg-gradient-to-r from-primary/60 via-neon/30 to-transparent sm:block"
                aria-hidden
              />
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
    <div className="my-8 flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface-low py-20 text-center ring-1 ring-border">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface">
        <SearchX className="size-7 text-primary" />
      </span>
      <p className="text-lg font-medium text-foreground">Sin resultados</p>
      <p className="text-sm text-muted-foreground">
        Prueba con otro título, género, categoría o rango de fechas.
      </p>
    </div>
  );
}
