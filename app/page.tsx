import { Suspense } from "react";

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

  // Re-key the Suspense boundary whenever the filters change so the skeleton
  // reappears while the (server-rendered) grid streams in with new data.
  // Opening a video is not a filter change, so `play` is excluded: keying on
  // it made every click on a card unmount the catalog and flash the skeleton,
  // which read as a full page reload.
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
