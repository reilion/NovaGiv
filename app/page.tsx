import { Suspense } from "react";
import { redirect } from "next/navigation";

import { FilterBarContainer } from "@/components/filters/filter-bar-container";
import { FilterBarSkeleton } from "@/components/filters/filter-bar-skeleton";
import { CatalogSection } from "@/components/media/catalog-section";
import { MediaGridSkeleton } from "@/components/media/media-grid-skeleton";
import { ProfileHeader } from "@/components/profile/profile-header";
import { getStreamerProfile } from "@/lib/queries";
import { filterStateKey, type SearchParamsRecord } from "@/lib/url";

interface HomePageProps {
  searchParams: Promise<SearchParamsRecord>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [profile, resolvedSearchParams] = await Promise.all([
    getStreamerProfile(),
    searchParams,
  ]);

  // Titles used to open as `?play=<slug>` on this page. Links to that are out
  // in the world, so they are forwarded to the page the title now has of its
  // own instead of quietly doing nothing.
  const legacyPlaySlug = resolvedSearchParams.play;
  if (typeof legacyPlaySlug === "string" && legacyPlaySlug) {
    redirect(`/v/${encodeURIComponent(legacyPlaySlug)}`);
  }

  // Re-key the Suspense boundary whenever the filters change so the skeleton
  // reappears while the (server-rendered) grid streams in with new data.
  const suspenseKey = filterStateKey(resolvedSearchParams);

  return (
    <>
      <ProfileHeader profile={profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<FilterBarSkeleton />}>
          <FilterBarContainer />
        </Suspense>

        <Suspense key={suspenseKey} fallback={<MediaGridSkeleton />}>
          <CatalogSection searchParams={resolvedSearchParams} />
        </Suspense>
      </main>
    </>
  );
}
