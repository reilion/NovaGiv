import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    remotePatterns: [
      // Demo poster/avatar images used by lib/mock-data.ts.
      { protocol: "https", hostname: "picsum.photos" },
      // Supabase Storage, once posters are uploaded there.
      { protocol: "https", hostname: "*.supabase.co" },
      // Ok.ru video/channel thumbnail CDN (used by the ok.ru import wizard).
      { protocol: "https", hostname: "iv.okcdn.ru" },
      { protocol: "https", hostname: "*.okcdn.ru" },
      { protocol: "https", hostname: "i.mycdn.me" },
      { protocol: "https", hostname: "*.mycdn.me" },
      // IMDb poster CDN (m.media-amazon.com).
      { protocol: "https", hostname: "m.media-amazon.com" },
      // TMDB poster CDN, another common poster source.
      { protocol: "https", hostname: "image.tmdb.org" },
      // AniList cover/banner CDN (s4.anilist.co, img.anili.st).
      { protocol: "https", hostname: "*.anilist.co" },
      { protocol: "https", hostname: "anilist.co" },
      { protocol: "https", hostname: "*.anili.st" },
      // MyAnimeList poster CDN, frequently paired with AniList metadata.
      { protocol: "https", hostname: "cdn.myanimelist.net" },
    ],
  },
};

export default nextConfig;
