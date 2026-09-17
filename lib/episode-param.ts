import type { Episode } from "@/types/media";

/**
 * How one episode is named in the URL: `?ep=12`, or `?ep=2x12` once the
 * collection has more than one season.
 *
 * Deliberately *not* the episode's id. Saving a collection in /admin replaces
 * every episode row (see `writeMediaItem` in lib/media-write.ts — that is also
 * why the view counters are carried over by ok.ru url), so those uuids change
 * on every edit and a link shared before one would stop resolving. The
 * season/number pair is what the admin form preserves, and it reads far better
 * in a link somebody pastes into a chat.
 */
export function episodeParam(episode: Episode): string {
  const season = episode.seasonNumber ?? 1;
  return season > 1 ? `${season}x${episode.episodeNumber}` : String(episode.episodeNumber);
}

/** Bounded on purpose: this parses a value straight out of the address bar. */
const EPISODE_PARAM = /^(?:(\d{1,4})x)?(\d{1,6})$/;

/**
 * The episode a `?ep=` value points at, or undefined when it matches none —
 * a stale link, a hand-typed number, an episode moved to another collection.
 * Callers fall back to the first episode, so a wrong value plays the
 * collection from the start instead of showing an error.
 */
export function findEpisodeByParam(
  episodes: Episode[],
  param: string | undefined
): Episode | undefined {
  if (!param) return undefined;

  const match = param.match(EPISODE_PARAM);
  if (!match) return undefined;

  const season = match[1] ? Number(match[1]) : 1;
  const number = Number(match[2]);

  // A collection with no seasons at all is season 1 here, matching episodeParam.
  return episodes.find(
    (episode) => (episode.seasonNumber ?? 1) === season && episode.episodeNumber === number
  );
}
