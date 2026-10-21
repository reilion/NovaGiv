"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GenreCount } from "@/lib/media-filter";
import { normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

interface GenrePickerProps {
  id?: string;
  value: string[];
  onChange: (genres: string[]) => void;
  /** Genres already in the catalog — see getAllGenresForAdmin(). */
  options: GenreCount[];
}

const keyOf = (genre: string) => normalizeSearch(genre.trim());

/**
 * Multi-select over the genres the catalog already uses, plus a way to add a
 * new one. Matching is by the folded key the catalog filter uses, so typing
 * "fantasia" offers the existing "Fantasía" rather than creating a duplicate.
 */
export function GenrePicker({ id, value, onChange, options }: GenrePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedKeys = useMemo(() => new Set(value.map(keyOf)), [value]);

  // Genres picked on this title that the catalog does not carry yet (just
  // created, or only used by this collection) still have to be listed.
  const allOptions = useMemo(() => {
    const known = new Set(options.map((option) => keyOf(option.genre)));
    const extra = value
      .filter((genre) => !known.has(keyOf(genre)))
      .map((genre) => ({ genre, count: 0 }));
    return [...options, ...extra].sort((a, b) => a.genre.localeCompare(b.genre, "es"));
  }, [options, value]);

  const trimmedQuery = query.trim();
  const queryKey = keyOf(query);
  const visible = queryKey
    ? allOptions.filter((option) => keyOf(option.genre).includes(queryKey))
    : allOptions;
  const exactMatch = queryKey
    ? allOptions.find((option) => keyOf(option.genre) === queryKey)
    : undefined;

  function toggle(genre: string) {
    const key = keyOf(genre);
    onChange(
      selectedKeys.has(key)
        ? value.filter((current) => keyOf(current) !== key)
        : [...value, genre]
    );
  }

  function create() {
    if (!trimmedQuery || exactMatch) return;
    onChange([...value, trimmedQuery]);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    // Never submit the whole form from inside the picker.
    event.preventDefault();
    if (exactMatch) {
      if (!selectedKeys.has(queryKey)) toggle(exactMatch.genre);
      setQuery("");
    } else {
      create();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverPrimitive.Trigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className="text-muted-foreground">
            {value.length === 0
              ? "Seleccionar géneros"
              : `${value.length} género${value.length === 1 ? "" : "s"} seleccionado${
                  value.length === 1 ? "" : "s"
                }`}
          </span>
          <ChevronDown className="size-4 opacity-60" />
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            className="isolate z-50 outline-none"
            align="start"
            sideOffset={4}
          >
            <PopoverPrimitive.Popup className="flex max-h-(--available-height) w-(--anchor-width) min-w-64 flex-col gap-1 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
              <div className="relative p-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar o crear un género…"
                  className="pl-8"
                  aria-label="Buscar género"
                />
              </div>

              <div className="max-h-64 overflow-y-auto" role="listbox" aria-multiselectable>
                {visible.length === 0 && !trimmedQuery && (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Todavía no hay géneros en el catálogo.
                  </p>
                )}
                {visible.map((option) => {
                  const selected = selectedKeys.has(keyOf(option.genre));
                  return (
                    <button
                      key={option.genre}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggle(option.genre)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
                        selected && "font-medium"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input",
                          selected && "border-primary bg-primary text-primary-foreground"
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 truncate">{option.genre}</span>
                      {option.count > 0 && (
                        <span className="text-xs text-muted-foreground">{option.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {trimmedQuery && !exactMatch && (
                <button
                  type="button"
                  onClick={create}
                  className="flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-2 text-left text-sm text-primary outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <Plus className="size-4" />
                  Crear género «{trimmedQuery}»
                </button>
              )}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((genre) => (
            <Badge key={genre} variant="secondary" className="gap-1 pr-1">
              {genre}
              <button
                type="button"
                onClick={() => toggle(genre)}
                className="rounded-sm opacity-60 hover:opacity-100"
                aria-label={`Quitar ${genre}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
