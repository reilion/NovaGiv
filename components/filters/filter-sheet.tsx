"use client";

import type { ReactNode } from "react";
import { CalendarRange, Filter, SlidersHorizontal, X } from "lucide-react";

import type { ActiveFilters, FilterUpdate } from "@/components/filters/filter-controls";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MONTHS, SORT_OPTIONS } from "@/lib/constants";
import type { GenreCount } from "@/lib/media-filter";
import { cn } from "@/lib/utils";

interface FilterSheetProps {
  active: ActiveFilters;
  genres: GenreCount[];
  streamYears: number[];
  onChange: (updates: FilterUpdate) => void;
  /** How many filters are on — the badge on the trigger. */
  activeCount: number;
  onReset: () => void;
  className?: string;
}

/** How many years get a pill of their own before the rest are left to «Todos». */
const YEAR_PILLS = 3;

/**
 * Phones: everything but the tabs and the search box, in a panel that slides
 * in from the right. Every pick writes the URL straight away like the desktop
 * row does, so «Aplicar» only has to close the panel.
 */
export function FilterSheet({
  active,
  genres,
  streamYears,
  onChange,
  activeCount,
  onReset,
  className,
}: FilterSheetProps) {
  const hasRange = Boolean(active.from || active.to);
  const years = streamYears.slice(0, YEAR_PILLS);
  // A year picked from a link can be older than the pills shown.
  if (active.year !== "all" && !years.includes(Number(active.year))) {
    years.push(Number(active.year));
  }

  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-surface-high px-3 text-sm font-medium text-foreground shadow-md transition-all active:scale-95",
          className
        )}
        aria-label="Abrir panel de filtros"
      >
        <SlidersHorizontal className="size-5 text-primary" />
        Filtros
        {activeCount > 0 && (
          <span className="label-caps ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[88vw] max-w-md gap-0 border-l-0 bg-surface-low p-0 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 bg-surface px-4 py-4 shadow-sm">
          <SheetTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <SlidersHorizontal className="size-[22px] text-primary" />
            Filtros y Búsqueda
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onReset}
              className="label-caps px-2 py-1 text-tertiary hover:underline"
            >
              Restablecer
            </button>
            <SheetClose
              aria-label="Cerrar panel de filtros"
              className="flex size-9 items-center justify-center rounded-lg bg-surface-highest text-foreground transition-all hover:bg-surface-high active:scale-95"
            >
              <X className="size-5" />
            </SheetClose>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <Section title="Ordenar por">
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Ordenar por">
              {SORT_OPTIONS.map((option) => {
                const selected = active.sort === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-lg p-2.5 text-sm transition-colors",
                      selected
                        ? "bg-surface-high text-foreground"
                        : "bg-surface text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{option.label}</span>
                    <input
                      type="radio"
                      name="sort_order"
                      checked={selected}
                      onChange={() => onChange({ sort: option.value })}
                      className="size-4 accent-primary"
                    />
                  </label>
                );
              })}
            </div>
          </Section>

          <Section
            title="Año de transmisión"
            aside={
              <span className="label-code text-muted-foreground">
                {hasRange ? "Rango activo" : active.year === "all" ? "Todos" : `${active.year} seleccionado`}
              </span>
            }
          >
            <div className={cn("grid grid-cols-4 gap-1.5", hasRange && "pointer-events-none opacity-50")}>
              {years.map((year) => (
                <Pill
                  key={year}
                  selected={active.year === String(year)}
                  onClick={() => onChange({ year: String(year) })}
                >
                  {year}
                </Pill>
              ))}
              <Pill selected={active.year === "all"} onClick={() => onChange({ year: null, month: null })}>
                Todos
              </Pill>
            </div>

            <div
              className={cn(
                "scrollbar-none -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pt-1.5",
                hasRange && "pointer-events-none opacity-50"
              )}
            >
              {MONTHS.map((month) => {
                const selected = active.month === month.value;
                return (
                  <button
                    key={month.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ month: selected ? null : month.value })}
                    className={cn(
                      "label-caps shrink-0 rounded px-2.5 py-1 transition-colors",
                      selected
                        ? "bg-[#ae05c6] text-[#ffd8fd]"
                        : "bg-surface text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {month.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Rango personalizado"
            aside={
              hasRange ? (
                <button
                  type="button"
                  onClick={() => onChange({ from: null, to: null })}
                  className="label-code flex items-center gap-1 text-tertiary"
                >
                  <X className="size-3" />
                  Quitar
                </button>
              ) : (
                <CalendarRange className="size-4 text-outline" />
              )
            }
          >
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={active.from}
                max={active.to || undefined}
                onChange={(event) => onChange({ from: event.target.value || null })}
                className="label-code min-w-0 flex-1 border-transparent bg-surface dark:bg-surface"
                aria-label="Desde"
              />
              <span className="text-xs text-muted-foreground">a</span>
              <Input
                type="date"
                value={active.to}
                min={active.from || undefined}
                onChange={(event) => onChange({ to: event.target.value || null })}
                className="label-code min-w-0 flex-1 border-transparent bg-surface dark:bg-surface"
                aria-label="Hasta"
              />
            </div>
            {hasRange && (
              <p className="text-xs text-muted-foreground">
                El rango personalizado reemplaza al año y al mes.
              </p>
            )}
          </Section>

          {genres.length > 0 && (
            <Section title="Géneros y colecciones">
              <div className="flex flex-wrap gap-1.5">
                {genres.map(({ genre, count }) => {
                  const selected = active.genre === genre;
                  return (
                    <button
                      key={genre}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange({ genre: selected ? null : genre })}
                      className={cn(
                        "label-code flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors",
                        selected
                          ? "bg-primary font-medium text-primary-foreground shadow-sm"
                          : "bg-surface-high text-foreground hover:bg-surface-highest"
                      )}
                    >
                      <span>{genre}</span>
                      <span className={selected ? "opacity-80" : "text-muted-foreground"}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        <div className="shrink-0 bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
          <SheetClose className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]">
            <Filter className="size-5" />
            Aplicar filtros
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps text-primary">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "label-code rounded-lg py-2 transition-colors",
        selected
          ? "bg-primary font-bold text-primary-foreground shadow-sm"
          : "bg-surface-high text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
