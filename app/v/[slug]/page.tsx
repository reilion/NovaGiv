import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MediaPlayer } from "@/components/player/media-player";
import { buttonVariants } from "@/components/ui/button";
import { loadMediaView } from "@/lib/media-view";
import { getMediaBySlug } from "@/lib/queries";
import { formatStreamRange } from "@/lib/stream-date";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/media";

interface MediaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ep?: string }>;
}

/** What a shared link says about a title when it has no description of its own. */
function describe(item: MediaItem): string {
  if (item.description) return item.description;

  const episodeCount = item.episodes?.length ?? 0;
  const parts = [
    episodeCount > 0 ? `${episodeCount} videos` : item.duration,
    formatStreamRange(item.firstStreamedAt, item.lastStreamedAt) || null,
  ].filter(Boolean);

  return parts.length > 0
    ? `${item.title} en NovaGiv — ${parts.join(" · ")}.`
    : `${item.title}, en el catálogo de streams de NovaGiv.`;
}

/**
 * The `images` field is left out on purpose: opengraph-image.tsx next to this
 * file is picked up automatically, and naming one here would replace it.
 */
export async function generateMetadata({ params }: MediaPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getMediaBySlug(slug);

  if (!item) return { title: "Título no encontrado | NovaGiv" };

  const description = describe(item);
  const url = `/v/${item.slug}`;

  return {
    title: `${item.title} | NovaGiv`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: item.title,
      description,
      url,
      siteName: "NovaGiv",
      type: "video.other",
      locale: "es_ES",
    },
    twitter: { card: "summary_large_image", title: item.title, description },
  };
}

/**
 * A title on its own page: what a shared link opens, and what a crawler sees.
 * Navigating here from the catalog shows the same thing as a dialog instead —
 * see app/@modal/(.)v/[slug].
 */
export default async function MediaPage({ params, searchParams }: MediaPageProps) {
  const [{ slug }, { ep }] = await Promise.all([params, searchParams]);
  const { item, likedVideoIds, savedVideoIds, initialEpisodeId } = await loadMediaView(slug, ep);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
          <ArrowLeft className="size-4" />
          Volver al catálogo
        </Link>
        <span className="font-heading text-sm font-medium text-muted-foreground">NovaGiv</span>
      </div>

      <MediaPlayer
        item={item}
        likedVideoIds={likedVideoIds}
        savedVideoIds={savedVideoIds}
        initialEpisodeId={initialEpisodeId}
        variant="page"
      />
    </div>
  );
}
