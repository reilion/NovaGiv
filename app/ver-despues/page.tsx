import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark, Heart } from "lucide-react";

import { RemoveFromWatchLaterButton } from "@/components/media/remove-from-watch-later-button";
import { VideoEntryList } from "@/components/media/video-entry-list";
import { buttonVariants } from "@/components/ui/button";
import { episodeParam } from "@/lib/episode-param";
import { getWatchLaterVideos } from "@/lib/queries";
import { loginPath } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Ver después | NovaGiv",
};

export default async function WatchLaterPage() {
  const entries = await getWatchLaterVideos();

  if (entries === null) redirect(loginPath("/ver-despues"));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Bookmark className="size-5 text-primary" />
            Ver después
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length === 0
              ? "Tu lista está vacía."
              : `${entries.length} ${entries.length === 1 ? "video pendiente" : "videos pendientes"}.`}
          </p>
        </div>

        <Link href="/me-gusta" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Heart className="size-4" />
          Mis me gusta
        </Link>
      </header>

      <div className="mt-6">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-4 py-16 text-center ring-1 ring-foreground/10">
            <Bookmark className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Pulsa «Ver después» en cualquier video y lo tendrás aquí esperándote.
            </p>
            <Link href="/" className={buttonVariants({ size: "sm" })}>
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          <VideoEntryList
            entries={entries}
            momentLabel="Añadido"
            action={(entry) => (
              <RemoveFromWatchLaterButton
                mediaItemId={entry.item.id}
                // Stored refs are always the ones episodeParam() produces, so
                // this names exactly the row the entry came from.
                episodeRef={entry.episode ? episodeParam(entry.episode) : undefined}
                title={entry.episode ? `${entry.item.title} · ${entry.episode.title}` : entry.item.title}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
