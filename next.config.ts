import type { NextConfig } from "next";

import { imageHostPatterns } from "./lib/image-hosts";

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
    // Exact hosts and paths only, shared with the admin's poster check — see
    // lib/image-hosts.ts for why there are no wildcards.
    remotePatterns: imageHostPatterns(),
  },
};

export default nextConfig;
