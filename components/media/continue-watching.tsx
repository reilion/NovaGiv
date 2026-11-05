import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookmarkPlus, Play, PlayCircle } from "lucide-react";

import { videoEntryHref, videoEntryKey } from "@/components/media/video-entry-list";
import { buttonVariants } from "@/components/ui/button";
import { getWatchHistory } from "@/lib/queries";
import { formatStreamDate } from "@/lib/stream-date";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { MEDIA_TYPE_TAGS } from "@/types/media";

/** A dozen is plenty for a shortcut back into things; /historial has the rest. */
const SHELF_LIMIT = 12;

/**
 * "Seguir viendo": the most recent collections this account opened, each one
 * linking straight back to the episode it was left on.
 *
 * For a visitor the same spot pitches the account instead — history is the
 * single most useful thing signing up gets you.
 */
export async function ContinueWatching() {
  const history = await getWatchHistory();

  if (history === null) return isSupabaseConfigured ? <GuestPrompt /> : null;
  if (history.length === 0) return null;

  const entries = history.slice(0, SHELF_LIMIT);

  return (
    <section className="flex flex-col gap-4 pt-4 sm:pt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PlayCircle className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Seguir viendo</h2>
            <p className="text-xs text-muted-foreground">Retoma cada colección donde la dejaste</p>
          </div>
        </div>
        <Link
          href="/historial"
          className="label-code group flex items-center gap-1 text-primary transition-colors hover:text-neon"
        >
          Ver todo el historial ({history.length})
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* A row that scrolls sideways rather than a grid: this is a shortcut back
          into something, not a place to browse. */}
      <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {entries.map((entry) => {
          const episodeCount = entry.item.episodes?.length ?? 0;
          const streamedAt = entry.episode?.streamedAt ?? entry.item.lastStreamedAt;

          return (
            <Link
              key={videoEntryKey(entry)}
              href={videoEntryHref(entry)}
              className="group/resume flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-surface-low ring-1 ring-border transition-all hover:-translate-y-1 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-surface">
                <Image
                  src={entry.item.posterUrl}
                  alt=""
                  fill
                  sizes="192px"
                  className="object-cover transition-transform duration-300 group-hover/resume:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-lowest via-surface-lowest/20 to-transparent" />
                <span className="label-code absolute left-2 top-2 rounded bg-surface-lowest/85 px-2 py-0.5 text-foreground backdrop-blur-md">
                  {entry.episode
                    ? `Ep. ${entry.episode.episodeNumber}${episodeCount > 0 ? ` de ${episodeCount}` : ""}`
                    : MEDIA_TYPE_TAGS[entry.item.type]}
                </span>
                <span className="absolute inset-0 flex items-center justify-center bg-surface-lowest/40 opacity-0 backdrop-blur-[2px] transition-opacity group-hover/resume:opacity-100">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Play className="size-5 fill-current" />
                  </span>
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1 p-3">
                {streamedAt && (
                  <p className="label-caps truncate text-neon">
                    Stream del {formatStreamDate(streamedAt, { short: true })}
                  </p>
                )}
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {entry.item.title}
                </p>
                {entry.episode && (
                  <p className="truncate text-xs text-muted-foreground">{entry.episode.title}</p>
                )}
                <span className="label-code mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-surface pt-2 pb-1.5 text-foreground transition-colors group-hover/resume:bg-primary group-hover/resume:text-primary-foreground">
                  <Play className="size-3 fill-current" />
                  Continuar
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * What a visitor sees where the shelf would be. Tablets and up only: phones get
 * the compact banner under the filter bar instead (CatalogGuestBanner).
 */
export function GuestPrompt() {
  return (
    <section className="hidden pt-8 md:block">
      <div className="relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl bg-surface-low p-5 ring-1 ring-border sm:flex-row sm:items-center sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookmarkPlus className="size-5" />
          </span>
          <div>
            <p className="text-base font-bold text-foreground sm:text-lg">
              ¿Quieres guardar dónde te quedaste?
            </p>
            <p className="text-sm text-muted-foreground">
              Crea tu cuenta con un nombre de usuario y ten tu historial, «Ver después» y tus me
              gusta en un solo lugar.
            </p>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          <Link href="/register" className={cn(buttonVariants(), "h-9 px-4 font-semibold")}>
            Crear cuenta gratis
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "secondary" }), "h-9 px-4")}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </section>
  );
}
