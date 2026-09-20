import { NextResponse, type NextRequest } from "next/server";

import { classifyUserAgent, type AgentKind } from "@/lib/bot-agents";
import { clientIp } from "@/lib/request-ip";
import { rateLimit, type RateLimitRule } from "@/lib/rate-limit";

/**
 * The door policy for the catalogue, applied by proxy.ts before anything else
 * runs. Two rules, in this order:
 *
 * 1. A client that announces itself as a scraping tool is turned away outright.
 * 2. Everything else gets a request budget per address, so copying the whole
 *    catalogue costs time whoever the copier says they are.
 *
 * Both are about volume, not secrecy: the catalogue is public and meant to be
 * read, and the point of this file is that reading all of it at machine speed
 * is not free. Anything that actually needs protecting is behind RLS in the
 * database, where a header cannot reach it.
 */

/**
 * `on` / `off` force it either way; unset, it follows the deployment. Off in
 * development because the dev server's own reloads would spend the budget in
 * seconds, and `on` is there to test this without building for production.
 */
const setting = process.env.BOT_PROTECTION;
const ENABLED =
  setting === "on" ? true : setting === "off" ? false : process.env.NODE_ENV === "production";

/**
 * Generous on purpose. A single person opening a page of the grid pulls the
 * document plus a prefetch for every card they hover, so a burst of dozens in a
 * few seconds is ordinary browsing — while a scraper walking the catalogue
 * never stops. It also has to survive a school or an office behind one address.
 */
const BROWSER_BUDGET: RateLimitRule = { limit: 120, windowMs: 30_000 };

/**
 * Tighter than a browser's, which is the right way round and not a typo: a
 * crawler that respects the site paces itself far below this, and the only
 * thing a smaller budget costs is whoever put "Googlebot" in their header to
 * get past the check above. Claiming to be a crawler should not be an upgrade.
 */
const CRAWLER_BUDGET: RateLimitRule = { limit: 60, windowMs: 30_000 };

/**
 * Never refused, whoever is asking. The first two are how a crawler is supposed
 * to find out what it may read — answering those with a 403 is incoherent. The
 * third carries the links Supabase mails out, and those are opened by whatever
 * the mail provider scans them with before they ever reach a browser.
 */
const ALWAYS_ALLOWED = ["/robots.txt", "/sitemap.xml", "/auth/"];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOWED.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path
  );
}

function budgetFor(kind: AgentKind): RateLimitRule {
  return kind === "crawler" ? CRAWLER_BUDGET : BROWSER_BUDGET;
}

/**
 * The response that should be sent instead of the page, or null to carry on.
 *
 * Kept separate from proxy.ts so the session refresh there stays readable, and
 * so this can be reasoned about — and turned off — on its own.
 */
export function botGuard(request: NextRequest): NextResponse | null {
  if (!ENABLED) return null;
  if (isAlwaysAllowed(request.nextUrl.pathname)) return null;

  const kind = classifyUserAgent(request.headers.get("user-agent"));

  if (kind === "tool") {
    return new NextResponse("Acceso automatizado no permitido.\n", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        // So a 403 never ends up cached as if it were the page, and never ends
        // up indexed as the site's content.
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  }

  const address = clientIp(request.headers);

  // No address to count against. Better to let it through than to file every
  // visitor under one shared tally and rate-limit the entire site into a 429 —
  // which is exactly what a deployment whose proxy forwards no address would
  // do. If this is production, that missing header is the thing to fix.
  if (!address) return null;

  const verdict = rateLimit(`page:${address}`, budgetFor(kind));
  if (verdict.allowed) return null;

  return new NextResponse("Demasiadas peticiones. Inténtalo de nuevo en un momento.\n", {
    status: 429,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(verdict.retryAfterSeconds),
    },
  });
}
