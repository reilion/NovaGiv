import type { NextConfig } from "next";

type RemotePattern = Exclude<NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number], URL>;

/**
 * This project's own Supabase host, read from the env rather than allowed as
 * `*.supabase.co`: /_next/image is a public endpoint, and a wildcard would let
 * anybody push images from *any* Supabase project through it — each one a
 * transformation billed to this account.
 */
function supabaseStoragePattern(): RemotePattern[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { hostname } = new URL(url);
    return [{ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
}

/**
 * Applied to every response. `frame-ancestors` (and its older twin,
 * X-Frame-Options) is what keeps the login form and /admin from being framed by
 * another site for clickjacking; `frame-src` lists the only two things this site
 * embeds: the ok.ru player and the Turnstile challenge.
 *
 * Deliberately not a full CSP yet: a `script-src` needs nonces wired through the
 * proxy, and getting it wrong breaks the site. These directives cannot.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "frame-src https://ok.ru https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  images: {
    // Every distinct (source, width, format) the optimizer serves is one
    // billed transformation on Vercel, so the width ladder is kept short:
    // posters and thumbnails converge on the same few variants instead of
    // the default 16. deviceSizes back the `vw`-based `sizes`, imageSizes the
    // fixed-pixel ones (admin list, episode rows, player poster).
    deviceSizes: [640, 1080, 1920],
    imageSizes: [32, 64, 128, 256],
    // WebP only: adding AVIF would double the transformations per image.
    formats: ["image/webp"],
    // 30 days. Posters and thumbnails never change at the same URL, so a
    // long TTL just spares re-transforming them once the cache expires.
    minimumCacheTTL: 2_592_000,
    // Exact hosts and paths only — no wildcards. Every pattern here is a door
    // through which a third party can spend this site's transformation quota,
    // so each is narrowed to the paths the catalog's posters actually use
    // (checked against the published rows). A poster from anywhere else needs
    // its pattern added here, or it will not render.
    remotePatterns: [
      ...supabaseStoragePattern(),
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
    ],
  },
};

export default nextConfig;
