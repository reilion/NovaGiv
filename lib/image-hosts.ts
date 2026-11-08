/**
 * Where catalog images may come from — the one list behind both
 * `images.remotePatterns` in next.config.ts and the poster check in the admin
 * write path (lib/validation/media-input.ts), so a poster the optimizer would
 * refuse to render can never be saved in the first place.
 *
 * Exact hosts and paths only, no wildcards: /_next/image is a public endpoint,
 * and every pattern here is a door through which a third party can spend this
 * site's transformation quota. Each one is narrowed to the paths the published
 * posters actually use. A poster from anywhere else needs its pattern added
 * here.
 *
 * Plain module, no `server-only`: next.config.ts imports it at build time.
 */

export interface ImageHostPattern {
  protocol: "https";
  hostname: string;
  /** Exact path, or a prefix ending in `/**`. */
  pathname: string;
}

const STATIC_PATTERNS: ImageHostPattern[] = [
  // Demo catalog (lib/mock-data.ts) and the profile banner.
  { protocol: "https", hostname: "picsum.photos", pathname: "/seed/**" },
  // ok.ru channel/video thumbnails, used as the poster of imported collections.
  { protocol: "https", hostname: "iv.okcdn.ru", pathname: "/videoPreview" },
  { protocol: "https", hostname: "iv.okcdn.ru", pathname: "/i" },
  { protocol: "https", hostname: "i.mycdn.me", pathname: "/image" },
  // IMDb posters.
  { protocol: "https", hostname: "m.media-amazon.com", pathname: "/images/**" },
  // TMDB posters.
  { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
  // AniList covers.
  { protocol: "https", hostname: "s4.anilist.co", pathname: "/file/anilistcdn/**" },
  // MyAnimeList covers (and its "no image" placeholder under /s/common).
  { protocol: "https", hostname: "cdn.myanimelist.net", pathname: "/images/**" },
  { protocol: "https", hostname: "cdn.myanimelist.net", pathname: "/s/common/**" },
];

/**
 * This project's own Supabase Storage, read from the env rather than allowed as
 * `*.supabase.co` — a wildcard would let anybody push images from *any*
 * Supabase project through the optimizer, billed to this account.
 */
function supabaseStoragePatterns(): ImageHostPattern[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { hostname } = new URL(url);
    return [{ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
}

export function imageHostPatterns(): ImageHostPattern[] {
  return [...supabaseStoragePatterns(), ...STATIC_PATTERNS];
}

function pathMatches(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -2); // keeps the trailing slash
    return pathname.startsWith(prefix);
  }
  return pathname === pattern;
}

/** Whether next/image will agree to optimize this URL. */
export function isAllowedImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return imageHostPatterns().some(
    (pattern) =>
      url.protocol === `${pattern.protocol}:` &&
      url.hostname === pattern.hostname &&
      pathMatches(pattern.pathname, url.pathname)
  );
}
