import type { MediaType, SortOption } from "@/types/media";

export const FILTER_TABS: { value: MediaType | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "movie", label: "Películas" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
  { value: "special", label: "Especiales / Votaciones" },
  { value: "karaoke", label: "Karaokes" },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "streamed", label: "Stream más reciente" },
  { value: "streamed-asc", label: "Stream más antiguo" },
  { value: "az", label: "A-Z" },
  { value: "year", label: "Año" },
];

export const MONTHS: { value: string; label: string }[] = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export const GENRES = [
  "Acción",
  "Aventura",
  "Comedia",
  "Drama",
  "Fantasía",
  "Terror",
  "Romance",
  "Ciencia ficción",
  "Slice of Life",
  "Musical",
  "Suspenso",
] as const;

/**
 * How many ok.ru channels /admin/import syncs in one run. ok.ru serves the
 * profile's channel grid 20 at a time and only a real browser can ask for the
 * rest, so the panel sticks to the most recent ones — which is where new
 * streams show up anyway. `pnpm okru:sync` is still the tool for the whole
 * catalogue.
 */
export const OKRU_SYNC_CHANNEL_LIMIT = 15;
