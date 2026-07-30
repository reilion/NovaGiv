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
