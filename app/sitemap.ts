import type { MetadataRoute } from "next";

import { getSitemapEntries } from "@/lib/queries";
import { getPublicSiteUrl } from "@/lib/site-url";

/** A stream date carries no zone ("2026-05-19T00:00:00"); a created_at does. */
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * Reading a wall-clock stream date as local time would move it by the server's
 * offset — the same trap lib/stream-date.ts avoids — so it is pinned to UTC
 * here. An unparseable value should not fail the whole sitemap either.
 */
function toDate(value: string): Date {
  const date = new Date(WALL_CLOCK.test(value) ? `${value}Z` : value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicSiteUrl();
  const entries = await getSitemapEntries();

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    // Only published titles reach this list: it is read with the anon key, so
    // RLS keeps drafts out without this having to filter them.
    ...entries.map((entry) => ({
      url: `${base}/v/${entry.slug}`,
      lastModified: toDate(entry.lastModified),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
