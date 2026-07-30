"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FILTER_TABS, GENRES, MONTHS, SORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function FilterBar({ streamYears = [] }: { streamYears?: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeTab = searchParams.get("tab") ?? "all";
  const activeGenre = searchParams.get("genre") ?? "all";
  // Keep in sync with DEFAULT_SORT in lib/media-filter.ts.
  const activeSort = searchParams.get("sort") ?? "streamed";
  const activeYear = searchParams.get("year") ?? "all";
  const activeMonth = searchParams.get("month") ?? "all";
  const activeFrom = searchParams.get("from") ?? "";
  const activeTo = searchParams.get("to") ?? "";
  const hasRange = Boolean(activeFrom || activeTo);
  const hasAnyDateFilter = hasRange || activeYear !== "all" || activeMonth !== "all";
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
      });
      // Any filter change closes whatever video is currently open.
      params.delete("play");

      startTransition(() => {
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounce the search box so typing doesn't fire a navigation per keystroke.
  useEffect(() => {
    const currentQ = searchParams.get("q") ?? "";
    if (searchValue === currentQ) return;

    const handle = setTimeout(() => updateParams({ q: searchValue || null }), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur-md transition-opacity supports-backdrop-filter:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        isPending && "opacity-70"
      )}
    >
      <Tabs
        value={activeTab}
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

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar por título…"
            className="pl-8"
            aria-label="Buscar contenido"
          />
        </div>

        <Select
          value={activeGenre}
          onValueChange={(value) => updateParams({ genre: String(value) })}
        >
          <SelectTrigger className="w-full sm:w-44">
            {/* Passing children explicitly avoids relying on the popup's
                items having mounted at least once to resolve a label. */}
            <SelectValue placeholder="Género">
              {activeGenre === "all" ? "Todos los géneros" : activeGenre}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los géneros</SelectItem>
            {GENRES.map((genre) => (
              <SelectItem key={genre} value={genre}>
                {genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeSort}
          onValueChange={(value) => updateParams({ sort: String(value) })}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Ordenar por">
              {SORT_OPTIONS.find((option) => option.value === activeSort)?.label}
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
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <span className="flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarRange className="size-4" />
          Fechas
        </span>

        <Select
          value={activeYear}
          onValueChange={(value) => updateParams({ year: String(value) })}
          disabled={hasRange}
        >
          <SelectTrigger className="w-40" aria-label="Año de stream">
            <SelectValue placeholder="Año">
              {activeYear === "all" ? "Todos los años" : activeYear}
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
          value={activeMonth}
          onValueChange={(value) => updateParams({ month: String(value) })}
          disabled={hasRange}
        >
          <SelectTrigger className="w-44" aria-label="Mes de stream">
            <SelectValue placeholder="Mes">
              {activeMonth === "all"
                ? "Todos los meses"
                : (MONTHS.find((m) => m.value === activeMonth)?.label ?? "Mes")}
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

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={activeFrom}
            max={activeTo || undefined}
            onChange={(event) => updateParams({ from: event.target.value || null })}
            className="w-40"
            aria-label="Desde"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="date"
            value={activeTo}
            min={activeFrom || undefined}
            onChange={(event) => updateParams({ to: event.target.value || null })}
            className="w-40"
            aria-label="Hasta"
          />
        </div>

        {hasRange && (
          <span className="text-xs text-muted-foreground">
            El rango personalizado reemplaza al año y al mes.
          </span>
        )}

        {hasAnyDateFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => updateParams({ year: null, month: null, from: null, to: null })}
          >
            <X className="size-3.5" />
            Limpiar fechas
          </Button>
        )}
      </div>
    </div>
  );
}
