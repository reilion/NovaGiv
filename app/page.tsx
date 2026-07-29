import { Suspense } from "react";

import { FilterBar } from "@/components/filters/filter-bar";
import { FilterBarSkeleton } from "@/components/filters/filter-bar-skeleton";
import { CatalogSection } from "@/components/media/catalog-section";
import { MediaGridSkeleton } from "@/components/media/media-grid-skeleton";
import { ProfileHeader } from "@/components/profile/profile-header";
import { getStreamerProfile } from "@/lib/queries";
import type { SearchParamsRecord } from "@/lib/url";

interface HomePageProps {
  searchParams: Promise<SearchParamsRecord>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [profile, resolvedSearchParams] = await Promise.all([
    getStreamerProfile(),
    searchParams,
  ]);

  // Re-key the Suspense boundary whenever filters change so the skeleton
  // reappears while the (server-rendered) grid streams in with new data.
  const suspenseKey = JSON.stringify(resolvedSearchParams);

  return (
    <>
      <ProfileHeader profile={profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<FilterBarSkeleton />}>
          <FilterBar />
        </Suspense>

        <Suspense key={suspenseKey} fallback={<MediaGridSkeleton />}>
          <CatalogSection searchParams={resolvedSearchParams} />
        </Suspense>
      </main>
    </>
  );
}
