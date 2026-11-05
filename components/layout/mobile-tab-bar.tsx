"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, CircleUserRound, Radio, Clapperboard } from "lucide-react";

import { cn } from "@/lib/utils";

const LIBRARY_ROUTES = ["/historial", "/ver-despues", "/me-gusta"];
const ACCOUNT_ROUTES = ["/account", "/login", "/register"];

function isUnder(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

const ITEM_CLASS =
  "relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors";

/**
 * Phones only: the four destinations of the app as a bottom tab bar — the
 * catalog, the live stream on Twitch, the personal lists and the account.
 * Renders a spacer in the flow too, so the last row of any page clears it.
 */
export function MobileTabBar({ twitchUrl, isLive }: { twitchUrl?: string; isLive: boolean }) {
  const pathname = usePathname();

  const catalogActive = pathname === "/" || pathname.startsWith("/v/");
  const listsActive = isUnder(pathname, LIBRARY_ROUTES);
  const accountActive = isUnder(pathname, ACCOUNT_ROUTES);

  const tone = (active: boolean) =>
    active ? "text-primary" : "text-muted-foreground hover:text-foreground";

  return (
    <>
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 md:hidden" aria-hidden />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 bg-surface-lowest/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_12px_rgba(0,0,0,0.6)] backdrop-blur-xl md:hidden"
      >
        <div className="flex h-16 items-center justify-around px-4">
          <Link
            href="/"
            aria-current={catalogActive ? "page" : undefined}
            className={cn(ITEM_CLASS, tone(catalogActive))}
          >
            <Clapperboard className="size-[22px]" />
            <span className="label-caps normal-case tracking-wide">Catálogo</span>
          </Link>

          <a
            href={twitchUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(ITEM_CLASS, isLive ? "text-tertiary" : tone(false))}
          >
            <span className="relative">
              <Radio className="size-[22px]" />
              {isLive && (
                <span className="absolute -right-1 -top-0.5 size-2 animate-pulse rounded-full bg-live" />
              )}
            </span>
            <span className="label-caps normal-case tracking-wide">En Vivo</span>
          </a>

          <Link
            href="/historial"
            aria-current={listsActive ? "page" : undefined}
            className={cn(ITEM_CLASS, tone(listsActive))}
          >
            <Bookmark className="size-[22px]" />
            <span className="label-caps normal-case tracking-wide">Listas</span>
          </Link>

          {/* /account sends anybody signed out to the sign-in page, so one link covers both. */}
          <Link
            href="/account"
            aria-current={accountActive ? "page" : undefined}
            className={cn(ITEM_CLASS, tone(accountActive))}
          >
            <CircleUserRound className="size-[22px]" />
            <span className="label-caps normal-case tracking-wide">Cuenta</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
