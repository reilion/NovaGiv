export type MediaType = "movie" | "series" | "anime" | "special" | "karaoke";

export type MediaStatus = "ongoing" | "completed";

export type SortOption = "recent" | "az" | "year";

export interface Episode {
  id: string;
  episodeNumber: number;
  /** Groups episodes into seasons for the series/anime modal. Omitted = single season. */
  seasonNumber?: number;
  title: string;
  okRuEmbedUrl: string;
  duration?: string;
  thumbnailUrl?: string;
}

export interface Season {
  seasonNumber: number;
  title?: string;
  episodes: Episode[];
}

export interface MediaItem {
  id: string;
  title: string;
  slug: string;
  type: MediaType;
  posterUrl: string;
  genres: string[];
  year?: number;
  description?: string;
  /** ISO date string, drives the "Más recientes" sort. */
  createdAt: string;
  /** Single-video items: movies, specials/votaciones, karaokes. */
  okRuEmbedUrl?: string;
  duration?: string;
  /** Multi-episode items: series, anime. */
  episodes?: Episode[];
  status?: MediaStatus;
  rating?: number;
}

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  movie: "Películas",
  series: "Series",
  anime: "Anime",
  special: "Especiales / Votaciones",
  karaoke: "Karaokes",
};

export const MEDIA_STATUS_LABELS: Record<MediaStatus, string> = {
  ongoing: "En emisión",
  completed: "Finalizada",
};

export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  recent: "Más recientes",
  az: "A-Z",
  year: "Año",
};

/** Media types that open the episode/season browser instead of playing directly. */
export function isEpisodic(type: MediaType): boolean {
  return type === "series" || type === "anime";
}
