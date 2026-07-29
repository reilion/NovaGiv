import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Demo poster/avatar images used by lib/mock-data.ts.
      { protocol: "https", hostname: "picsum.photos" },
      // Supabase Storage, once posters are uploaded there.
      { protocol: "https", hostname: "*.supabase.co" },
      // Ok.ru thumbnail CDN.
      { protocol: "https", hostname: "i.mycdn.me" },
      { protocol: "https", hostname: "*.mycdn.me" },
    ],
  },
};

export default nextConfig;
