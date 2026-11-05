"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search, X } from "lucide-react";

import {
  FilterControls,
  type ActiveFilters,
  type FilterUpdate,
} from "@/components/filters/filter-controls";
import { FilterSheet } from "@/components/filters/filter-sheet";
import { Input } from "@/components/ui/input";
import {
  CATALOG_SEARCH_ID,
  FILTER_TABS,
  MONTHS,
  SORT_OPTIONS,
  UPCOMING_FILTER_TABS,
} from "@/lib/constants";
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
        "sticky top-[65px] z-30 -mx-4 mt-2 flex flex-col gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-xl transition-opacity supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:mt-8 sm:gap-3 sm:px-6 sm:py-4 lg:-mx-8 lg:px-8",
        isPending && "opacity-70"
      )}
    >
      <div
        className="scrollbar-none -mx-4 order-2 flex items-center gap-1.5 overflow-x-auto px-4 py-0.5 sm:order-1 sm:-mx-1 sm:gap-2 sm:px-1 sm:pb-0.5 sm:pt-0"
        role="group"
        aria-label="Tipo de contenido"
      >
        {FILTER_TABS.map((tab) => {
          const selected = active.tab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={selected}
              onClick={() => updateParams({ tab: tab.value === "all" ? null : tab.value })}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all sm:rounded-lg sm:px-3.5 sm:text-sm sm:font-medium",
                selected
                  ? "bg-primary text-primary-foreground shadow-[0_0_16px_-4px_rgba(208,188,255,0.5)]"
                  : "bg-surface-low text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
        {UPCOMING_FILTER_TABS.map((tab) => (
          <span
            key={tab.value}
            className="flex shrink-0 cursor-default items-center gap-1.5 rounded-full bg-surface-low px-3 py-1.5 text-xs font-semibold text-muted-foreground/50 sm:rounded-lg sm:bg-transparent sm:text-sm sm:font-medium"
            title="Muy pronto en el catálogo"
          >
            {tab.label}
            <span className="label-caps rounded bg-surface-highest px-1.5 py-0.5 text-[10px] normal-case text-outline">
              Pronto
            </span>
          </span>
        ))}
      </div>

      <div className="order-1 flex items-center gap-1 sm:order-2 sm:flex-wrap sm:gap-2">
        <div className="relative min-w-0 flex-1 sm:min-w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-outline" />
          <Input
            id={CATALOG_SEARCH_ID}
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por título, ep. o fecha…"
            className="h-10 rounded-xl border-transparent bg-surface pl-9 pr-9 shadow-inner dark:bg-surface sm:rounded-lg sm:bg-surface-low sm:shadow-none sm:dark:bg-surface-low [&::-webkit-search-cancel-button]:hidden"
            aria-label="Buscar contenido"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              aria-label="Borrar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Phones only: everything but the tabs and the search folds in here, so
            the bar stops eating half the screen before a single poster shows. */}
        <FilterSheet
          {...controlProps}
          activeCount={chips.length}
          onReset={clearAll}
          className="sm:hidden"
        />

        <div className="hidden sm:contents">
          <FilterControls {...controlProps} />
        </div>
      </div>

      {showChipsRow && (
        <div className="scrollbar-none order-3 -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:gap-2 sm:px-0">
          <span className="label-caps hidden text-outline sm:inline">Filtros activos:</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => updateParams(chip.clear)}
              aria-label={`Quitar filtro: ${chip.label}`}
              className="label-code inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-highest py-1 pl-2.5 pr-1.5 text-neon transition-colors hover:bg-surface-high sm:rounded sm:bg-surface sm:pl-2 sm:text-primary"
            >
              {chip.label}
              <X className="size-3 text-muted-foreground" />
            </button>
          ))}

          <button
            type="button"
            onClick={clearAll}
            className="label-code inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-tertiary transition-colors hover:text-foreground sm:text-neon"
          >
            <RotateCcw className="size-3" />
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
