import "server-only";

import { headers } from "next/headers";

/**
 * Absolute origin of the site, for the links Supabase mails out (confirming a
 * sign-up, confirming a new email). Those come back as a full URL, so a
 * relative path is not enough.
 *
 * Derived from the request unless SITE_URL says otherwise — set that one behind
 * a proxy that rewrites the host, or to pin the links to the canonical domain.
 * Whatever this resolves to must be listed under Authentication -> URL
 * Configuration -> Redirect URLs in the Supabase dashboard, or the link comes
 * back to the site root instead.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

/**
 * Canonical origin, resolved without a request — what `metadataBase`, the
 * sitemap and robots.txt need, since all three can be produced at build time
 * where there are no headers to read.
 *
 * A shared link has to carry the *canonical* host anyway: derived from the
 * request, the same title would advertise itself under whatever preview domain
 * happened to serve it. Set SITE_URL in production; on Vercel the project's
 * production domain is the next best guess.
 */
export function getPublicSiteUrl(): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelDomain) return `https://${vercelDomain.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
