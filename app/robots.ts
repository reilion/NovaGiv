import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind a session is worth crawling, and the auth forms would
      // only ever be indexed as duplicates of each other.
      disallow: ["/admin", "/account", "/login", "/register", "/auth"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
