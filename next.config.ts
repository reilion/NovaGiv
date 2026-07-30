import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
    ],
  },
};

export default nextConfig;
