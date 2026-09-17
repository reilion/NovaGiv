"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  FilterControls,
  type ActiveFilters,
  type FilterUpdate,
} from "@/components/filters/filter-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FILTER_TABS, MONTHS, SORT_OPTIONS } from "@/lib/constants";
import { DEFAULT_SORT, type GenreCount } from "@/lib/media-filter";
import { formatStreamDate } from "@/lib/stream-date";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  /** Years present in the catalog, newest first. */
  streamYears?: number[];
  /** Genres present in the catalog, with how many collections carry each. */
  genres?: GenreCount[];
}

interface ActiveChip {
  key: string;
  label: string;
  /** What to drop from the URL when this chip is removed. */
  clear: FilterUpdate;
}

function rangeLabel(from: string, to: string): string {
  if (from && to) return `${formatStreamDate(from)} – ${formatStreamDate(to)}`;
  return from ? `Desde ${formatStreamDate(from)}` : `Hasta ${formatStreamDate(to)}`;
}

/**
 * The filters that live behind the "Filtros" button, as chips. The badge on
 * that button counts this same list, so the number can never disagree with what
 * is listed underneath.
 *
 * The tabs and the search box are deliberately left out: both stay on screen at
 * every width, so a chip would only repeat them.
 */
function activeChipsOf(active: ActiveFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (active.genre !== "all") {
    chips.push({ key: "genre", label: active.genre, clear: { genre: null } });
  }

  if (active.sort !== DEFAULT_SORT) {
    const label = SORT_OPTIONS.find((option) => option.value === active.sort)?.label;
    if (label) chips.push({ key: "sort", label, clear: { sort: null } });
  }

  // A custom range replaces the year and month rather than stacking with them
  // (see filterAndSortMedia), so listing those beside it would show a filter
  // that is not actually being applied.
  if (active.from || active.to) {
    chips.push({
      key: "range",
      label: rangeLabel(active.from, active.to),
      clear: { from: null, to: null },
    });
    return chips;
  }

  if (active.year !== "all") {
    chips.push({ key: "year", label: active.year, clear: { year: null } });
  }

  if (active.month !== "all") {
    const label = MONTHS.find((month) => month.value === active.month)?.label;
    if (label) chips.push({ key: "month", label, clear: { month: null } });
  }

  return chips;
}

export function FilterBar({ streamYears = [], genres = [] }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const active: ActiveFilters = {
    tab: searchParams.get("tab") ?? "all",
    genre: searchParams.get("genre") ?? "all",
    sort: searchParams.get("sort") ?? DEFAULT_SORT,
    year: searchParams.get("year") ?? "all",
    month: searchParams.get("month") ?? "all",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  };

  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");

  // The params as of the last render, read through a ref so a write that was
  // scheduled earlier still lands on the current URL. Without it the debounced
  // search below would rebuild the query from the snapshot it captured when the
  // timer was set, putting back every filter cleared in the meantime — which is
  // exactly what "Limpiar todo" does, a moment before the timer fires.
  const latestParams = useRef<URLSearchParams>(searchParams);
  useEffect(() => {
    // Only when a navigation actually commits: re-rendering because a
    // transition is pending must not put the pre-update params back.
    latestParams.current = searchParams;
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: FilterUpdate) => {
      const params = new URLSearchParams(latestParams.current.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
      });

      // Kept in step by hand: nothing re-renders between here and the commit,
      // so a second update fired in the same tick would otherwise start from
      // the params this one just replaced.
      latestParams.current = params;

      startTransition(() => {
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router]
  );

  // Debounce the search box so typing doesn't fire a navigation per keystroke.
  useEffect(() => {
    const currentQ = searchParams.get("q") ?? "";
    if (searchValue === currentQ) return;

    const handle = setTimeout(() => updateParams({ q: searchValue || null }), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const chips = activeChipsOf(active);
  // The tab is cleared too — the button says "todo" — but it alone does not
  // bring the row on screen, since the selected tab is never hidden.
  const showChipsRow = chips.length > 0 || searchValue.trim() !== "";

  function clearAll() {
    // The input holds its own state, so emptying the URL is not enough.
    setSearchValue("");
    updateParams({
      tab: null,
      q: null,
      genre: null,
      sort: null,
      year: null,
      month: null,
      from: null,
      to: null,
    });
  }

  const controlProps = { active, genres, streamYears, onChange: updateParams };

  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur-md transition-opacity supports-backdrop-filter:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        isPending && "opacity-70"
      )}
    >
      <Tabs
        value={active.tab}
        onValueChange={(value) => updateParams({ tab: value === "all" ? null : String(value) })}
      >
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar título, episodio o fecha…"
            className="pl-8 pr-8"
            aria-label="Buscar contenido"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              aria-label="Borrar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Phones only: everything but the tabs and the search folds in here, so
            the bar stops eating half the screen before a single poster shows. */}
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline" className="shrink-0 sm:hidden" />}
            aria-label="Abrir filtros"
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {chips.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                {chips.length}
              </span>
            )}
          </SheetTrigger>

          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>

            <div className="px-4">
              <FilterControls {...controlProps} stacked />
            </div>

            <SheetFooter className="flex-row gap-2">
              {chips.length > 0 && (
                <Button type="button" variant="outline" className="flex-1" onClick={clearAll}>
                  Limpiar todo
                </Button>
              )}
              <SheetClose render={<Button className="flex-1" />}>Ver resultados</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mt-3 hidden sm:flex">
        <FilterControls {...controlProps} />
      </div>

      {showChipsRow && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => updateParams(chip.clear)}
              aria-label={`Quitar filtro: ${chip.label}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-2.5 pr-1.5 text-xs text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}

          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  );
}
