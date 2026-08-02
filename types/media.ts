export type MediaType = "movie" | "series" | "anime" | "special" | "karaoke";

export type MediaStatus = "ongoing" | "completed";

export type SortOption = "recent" | "az" | "year" | "streamed" | "streamed-asc";

export interface Episode {
  id: string;
  episodeNumber: number;
  /** Groups episodes into seasons for the series/anime modal. Omitted = single season. */
  seasonNumber?: number;
  title: string;
  okRuEmbedUrl: string;
  duration?: string;
  thumbnailUrl?: string;
  /** Wall-clock date of the stream ("YYYY-MM-DDTHH:MM:SS"), parsed from the ok.ru title. */
  streamedAt?: string;
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
  /** Drafts (false) are hidden from the public catalog until the admin publishes them. Defaults to true. */
  published?: boolean;
  /** Oldest stream date across this collection's episodes ("YYYY-MM-DDTHH:MM:SS"). */
  firstStreamedAt?: string;
  /** Newest stream date across this collection's episodes. */
  lastStreamedAt?: string;
  /**
   * ok.ru channel this collection was imported from ("c1234567890"). Stable
   * across renames on both sides, so `pnpm okru:sync` keeps matching the same
   * collection and only appends its new videos.
   */
  okruChannelId?: string;
  /** The channel's name on ok.ru — the original name, kept after renaming the collection. */
  okruChannelName?: string;
  okruChannelUrl?: string;
  /**
   * True on the one collection per channel that `pnpm okru:sync` appends new
   * videos to. The others were split out of it (e.g. a movie of its own) and
   * keep the reference only as provenance.
   */
  okruChannelPrimary?: boolean;
}

/** The ok.ru origin of a collection, as edited in the admin form. */
export interface OkRuChannelRef {
  id: string;
  name: string;
  url?: string;
}

/** One episode as edited in the admin form. */
export interface EpisodeInput {
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  okRuEmbedUrl: string;
  duration?: string;
  thumbnailUrl?: string;
  /** "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS"; drives the collection's date range. */
  streamedAt?: string;
  /**
   * Set when the episode was pulled from another collection of the same
   * channel: the row with this id is removed from that collection when this
   * one is saved, so a video never ends up in two places.
   */
  claimedFromEpisodeId?: string;
}

/** Everything the admin form writes for one collection. */
export interface MediaFormInput {
  id?: string;
  title: string;
  slug: string;
  type: MediaType;
  posterUrl: string;
  genres: string[];
  year?: number;
  description?: string;
  duration?: string;
  okRuEmbedUrl?: string;
  status?: MediaStatus;
  rating?: number;
  /** Hidden from the public catalog while false — e.g. an ok.ru import awaiting review. */
  published: boolean;
  episodes: EpisodeInput[];
  /**
   * Stream date of a single-video collection (movie, special, karaoke). For
   * episodic ones the range is derived from the episodes instead.
   */
  streamedAt?: string;
  /**
   * ok.ru channel this collection comes from. Persisted so `pnpm okru:sync`
   * can find the collection again after it has been renamed here. Null clears
   * the link; undefined leaves whatever is stored untouched.
   */
  okruChannel?: OkRuChannelRef | null;
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
  streamed: "Fecha de stream (recientes)",
  "streamed-asc": "Fecha de stream (antiguos)",
};

/** Media types that open the episode/season browser instead of playing directly. */
export function isEpisodic(type: MediaType): boolean {
  return type === "series" || type === "anime";
}
