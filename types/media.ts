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
  /** Times this video was opened in the player. */
  views?: number;
  /** People who liked this video. One per account, so it can be taken back. */
  likes?: number;
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
  /**
   * Times this collection's own video was opened — movies, karaokes and
   * especiales. Episodic collections count on their episodes instead, so use
   * `totalViewsOf` for the number shown to the viewer.
   */
  views?: number;
  /** Likes of this collection's own video. Episodic ones count on the episodes. */
  likes?: number;
}

/**
 * One card of the catalog grid, exactly as `search_media` hands it over.
 *
 * Deliberately not a `MediaItem`: the grid never draws an episode, and a
 * collection of two hundred streams used to ship all two hundred of them to
 * render a "200 ep." badge. Everything the card needs that used to be derived
 * from that list — the episode count, the view and like totals, which episodes
 * a search matched — is aggregated by the `media_catalog` view instead, so a
 * page of the catalog costs the same whatever the collections hold.
 */
export interface CatalogItem {
  id: string;
  title: string;
  slug: string;
  type: MediaType;
  posterUrl: string;
  genres: string[];
  year?: number;
  duration?: string;
  status?: MediaStatus;
  createdAt: string;
  firstStreamedAt?: string;
  lastStreamedAt?: string;
  /** Videos in the collection; 0 for a movie, karaoke or especial. */
  episodeCount: number;
  /** Every video of the collection added up — what `totalViewsOf` derives. */
  views: number;
  /** Same for likes — see `totalLikesOf`. */
  likes: number;
  /** Episodes matching the active search; 0 when nothing is being searched. */
  matchedEpisodes: number;
  /** `?ep=` value of the first of them, so the card opens straight at it. */
  matchedEpisodeRef?: string;
}

/**
 * A catalog card plus what this particular visitor makes of it. Resolved per
 * page on the server rather than passed down as two id sets, so a page appended
 * by the infinite scroll arrives already knowing its own badges.
 */
export interface CatalogCard extends CatalogItem {
  /** True once this account has opened the collection — see the history shelf. */
  watched: boolean;
  /** Added since this browser's previous visit — see lib/last-visit.ts. */
  isNew: boolean;
}

/** How many collections one year section holds across a whole result. */
export interface CatalogYearCount {
  /** null for the trailing section of collections with no stream date. */
  year: number | null;
  count: number;
}

/**
 * One page of the catalog grid. Produced on the server by `getCatalogPage`
 * (lib/catalog.ts) and appended to in the browser by the infinite scroll, which
 * is why it lives here rather than beside the query: both halves need the shape.
 */
export interface CatalogPage {
  items: CatalogCard[];
  /** Collections matching the filters in total — not just the ones loaded. */
  total: number;
  /** Where the next page starts, or null once there is nothing left. */
  nextOffset: number | null;
  /**
   * Counted over the whole result, so a year heading can say how many
   * collections it holds before the scroll has reached the end of it.
   */
  yearCounts: CatalogYearCount[];
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

/**
 * Views of the whole collection: the sum of every video it holds. Derived on
 * read rather than stored, so it can never drift from the per-video counters
 * after an episode is moved into another collection.
 */
export function totalViewsOf(item: MediaItem): number {
  const episodeViews = (item.episodes ?? []).reduce((sum, episode) => sum + (episode.views ?? 0), 0);
  return (item.views ?? 0) + episodeViews;
}

/** Likes of the whole collection: same reasoning as `totalViewsOf`. */
export function totalLikesOf(item: MediaItem): number {
  const episodeLikes = (item.episodes ?? []).reduce((sum, episode) => sum + (episode.likes ?? 0), 0);
  return (item.likes ?? 0) + episodeLikes;
}

/** Media types that open the episode/season browser instead of playing directly. */
export function isEpisodic(type: MediaType): boolean {
  return type === "series" || type === "anime";
}
