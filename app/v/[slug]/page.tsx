import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PlayerPage } from "@/components/player/player-page";
import { buttonVariants } from "@/components/ui/button";
import { loadMediaView } from "@/lib/media-view";
import { getMediaBySlug } from "@/lib/queries";
import { formatStreamRange } from "@/lib/stream-date";
import { cn } from "@/lib/utils";
import { MEDIA_TYPE_LABELS, type MediaItem } from "@/types/media";

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
    <PlayerPage
      item={item}
      likedVideoIds={likedVideoIds}
      savedVideoIds={savedVideoIds}
      initialEpisodeId={initialEpisodeId}
      toolbar={
        <>
        {/* Phones: a back arrow and the title, like the top bar of an app. */}
        <div className="-mx-4 flex items-center gap-3 px-4 py-3 sm:hidden">
          <Link
            href="/"
            aria-label="Volver al catálogo"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-low text-foreground transition-colors hover:bg-surface"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
            <p className="label-caps truncate text-primary">{MEDIA_TYPE_LABELS[item.type]}</p>
          </div>
        </div>
        <nav
          aria-label="Ruta"
          className="mb-4 hidden flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface-low p-2 ring-1 ring-border sm:flex"
        >
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "font-semibold")}>
            <ArrowLeft className="size-4" />
            Volver al catálogo
          </Link>
          <ol className="label-code flex min-w-0 flex-wrap items-center gap-1.5 text-outline">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Catálogo
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={`/?tab=${item.type}`} className="transition-colors hover:text-foreground">
                {MEDIA_TYPE_LABELS[item.type]}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="min-w-0 truncate text-foreground" aria-current="page">
              {item.title}
            </li>
          </ol>
        </nav>
        </>
      }
    />
  );
}
