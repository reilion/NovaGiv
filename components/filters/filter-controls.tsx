"use client";

import { CalendarRange, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTHS, SORT_OPTIONS } from "@/lib/constants";
import type { GenreCount } from "@/lib/media-filter";
import { cn } from "@/lib/utils";

/** The filter state as the URL holds it; "all" and "" mean unset. */
export interface ActiveFilters {
  tab: string;
  genre: string;
  sort: string;
  year: string;
  month: string;
  from: string;
  to: string;
}

/** A set of search-param writes; null removes the key. */
export type FilterUpdate = Record<string, string | null>;

interface FilterControlsProps {
  active: ActiveFilters;
  genres: GenreCount[];
  streamYears: number[];
  onChange: (updates: FilterUpdate) => void;
  /**
   * Full-width, labelled controls for the mobile sheet. Inline (the default) is
   * the desktop row, where each control's own value already says what it is.
   */
  stacked?: boolean;
}

/**
 * Genre, sort and dates — everything the catalog filters by except the tabs and
 * the search box, which stay on screen at every width.
 *
 * Rendered twice, in two shapes: inline on desktop, and inside the sheet on
 * phones (see components/filters/filter-bar.tsx). Only one of the two is ever
 * mounted, since the sheet's content only exists while it is open.
 */
export function FilterControls({
  active,
  genres,
  streamYears,
  onChange,
  stacked = false,
}: FilterControlsProps) {
  const hasRange = Boolean(active.from || active.to);
  const hasAnyDateFilter = hasRange || active.year !== "all" || active.month !== "all";

  return (
    <div className={cn("flex w-full gap-3", stacked ? "flex-col" : "flex-wrap items-end")}>
      <Labelled label="Género" stacked={stacked}>
        <Select value={active.genre} onValueChange={(value) => onChange({ genre: String(value) })}>
          <SelectTrigger className={cn(stacked ? "w-full" : "w-44")}>
            {/* Passing children explicitly avoids relying on the popup's
                items having mounted at least once to resolve a label. */}
            <SelectValue placeholder="Género">
              {active.genre === "all" ? "Todos los géneros" : active.genre}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los géneros</SelectItem>
            {/* Straight from the catalog, so every option here has something
                behind it and a genre invented in /admin shows up on its own. */}
            {genres.map(({ genre, count }) => (
              <SelectItem key={genre} value={genre}>
                <span className="flex-1">{genre}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Labelled>

      <Labelled label="Ordenar por" stacked={stacked}>
        <Select value={active.sort} onValueChange={(value) => onChange({ sort: String(value) })}>
          <SelectTrigger className={cn(stacked ? "w-full" : "w-56")}>
            <SelectValue placeholder="Ordenar por">
              {SORT_OPTIONS.find((option) => option.value === active.sort)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Labelled>

      <div
        className={cn(
          "flex gap-2",
          stacked ? "flex-col" : "flex-wrap items-end border-l border-border/60 pl-3"
        )}
      >
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
            // Inline, it sits in a row of controls and has to line up with them.
            !stacked && "h-9"
          )}
        >
          <CalendarRange className="size-4" />
          Fechas
        </span>

        <div className={cn("flex gap-2", stacked && "w-full")}>
          <Select
            value={active.year}
            onValueChange={(value) => onChange({ year: String(value) })}
            disabled={hasRange}
          >
            <SelectTrigger className={cn(stacked ? "flex-1" : "w-36")} aria-label="Año de stream">
              <SelectValue placeholder="Año">
                {active.year === "all" ? "Todos los años" : active.year}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los años</SelectItem>
              {streamYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={active.month}
            onValueChange={(value) => onChange({ month: String(value) })}
            disabled={hasRange}
          >
            <SelectTrigger className={cn(stacked ? "flex-1" : "w-40")} aria-label="Mes de stream">
              <SelectValue placeholder="Mes">
                {active.month === "all"
                  ? "Todos los meses"
                  : (MONTHS.find((month) => month.value === active.month)?.label ?? "Mes")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={cn("flex items-center gap-1.5", stacked && "w-full")}>
          <Input
            type="date"
            value={active.from}
            max={active.to || undefined}
            onChange={(event) => onChange({ from: event.target.value || null })}
            className={cn(stacked ? "min-w-0 flex-1" : "w-40")}
            aria-label="Desde"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="date"
            value={active.to}
            min={active.from || undefined}
            onChange={(event) => onChange({ to: event.target.value || null })}
            className={cn(stacked ? "min-w-0 flex-1" : "w-40")}
            aria-label="Hasta"
          />
        </div>

        {hasAnyDateFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(stacked && "self-start")}
            onClick={() => onChange({ year: null, month: null, from: null, to: null })}
          >
            <X className="size-3.5" />
            Limpiar fechas
          </Button>
        )}
      </div>

      {hasRange && (
        <p className="text-xs text-muted-foreground">
          El rango personalizado reemplaza al año y al mes.
        </p>
      )}
    </div>
  );
}

/** A label above the control, but only in the sheet — inline they speak for themselves. */
function Labelled({
  label,
  stacked,
  children,
}: {
  label: string;
  stacked: boolean;
  children: React.ReactNode;
}) {
  if (!stacked) return <>{children}</>;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
