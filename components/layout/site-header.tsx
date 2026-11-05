import { Suspense } from "react";

import { AccountMenu, AccountMenuSkeleton } from "@/components/auth/account-menu";
import { BrandMark } from "@/components/layout/brand-mark";
import { HeaderNav, HeaderSearch, MobileNav, MobileSearchButton } from "@/components/layout/header-nav";
import { getStreamerProfile } from "@/lib/queries";

/**
 * The public header: logo, type links, the live pill while the streamer is on
 * air, search, and the account. Sticky, so the catalog's filter bar parks just
 * under it (`top-16`).
 */
export async function SiteHeader() {
  const profile = await getStreamerProfile();
  const twitch = profile.socials.find((social) => social.platform === "twitch");

  return (
    <header className="sticky top-0 z-40 bg-surface-lowest/90 shadow-[0_1px_12px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 xl:gap-6">
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <BrandMark />
          <Suspense fallback={null}>
            <HeaderNav />
          </Suspense>
          {/* Phones: just the word, next to the logo — the title of the
              stream lives in the catalog's live card. */}
          {profile.isLive && (
            <a
              href={twitch?.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-live/20 px-2 py-0.5 lg:hidden"
            >
              <span className="size-2 animate-pulse rounded-full bg-live" />
              <span className="label-caps text-tertiary">En vivo</span>
            </a>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {profile.isLive && (
            <a
              href={twitch?.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group hidden max-w-64 shrink-0 items-center gap-2 rounded-full bg-surface-low px-3 py-1.5 transition-colors hover:bg-surface lg:flex xl:hidden 2xl:flex"
            >
              <LiveDot />
              <span className="label-caps whitespace-nowrap text-tertiary">En vivo</span>
              {profile.liveTitle && (
                <>
                  <span className="h-3 w-px bg-outline-variant" />
                  <span className="truncate text-xs text-muted-foreground group-hover:text-foreground">
                    {profile.liveTitle}
                  </span>
                </>
              )}
            </a>
          )}

          <Suspense fallback={null}>
            <HeaderSearch className="hidden md:block xl:hidden 2xl:block" />
            <MobileSearchButton className="md:hidden" />
          </Suspense>

          <Suspense fallback={<AccountMenuSkeleton />}>
            <AccountMenu />
          </Suspense>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </header>
  );
}

/** The pulsing rose dot that marks anything happening live. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={`relative flex size-2.5 shrink-0 ${className ?? ""}`}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-live" />
    </span>
  );
}
