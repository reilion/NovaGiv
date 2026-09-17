import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Layers } from "lucide-react";

import { episodeParam } from "@/lib/episode-param";
import type { VideoEntry } from "@/lib/queries";
import { MEDIA_TYPE_LABELS } from "@/types/media";

/** Where an entry resumes: the collection, at the exact video it points to. */
export function videoEntryHref(entry: VideoEntry): string {
  return entry.episode
    ? `/v/${entry.item.slug}?ep=${episodeParam(entry.episode)}`
    : `/v/${entry.item.slug}`;
}

/** Two entries of the same collection are different videos of it. */
export function videoEntryKey(entry: VideoEntry): string {
  return `${entry.item.id}:${entry.episode?.id ?? "self"}`;
}

function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

interface VideoEntryListProps {
  entries: VideoEntry[];
  /** What the date on each row means — "Guardado" / "Visto". */
  momentLabel: string;
  /** Optional control on the right of a row, e.g. removing it. */
  action?: (entry: VideoEntry) => ReactNode;
}

/**
 * The shape both /me-gusta and /historial take: one row per video, each
 * resuming exactly where it points — an episode for a series, the collection
 * itself for a movie, karaoke or especial.
 */
export function VideoEntryList({ entries, momentLabel, action }: VideoEntryListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const { item, episode } = entry;
        const moment = formatMoment(entry.at);

        return (
          <li
            key={videoEntryKey(entry)}
            className="flex items-center gap-3 rounded-xl bg-card p-2 ring-1 ring-foreground/10 transition-colors hover:bg-accent/50"
          >
            <Link
              href={videoEntryHref(entry)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image
                  src={item.posterUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                {episode ? (
                  <p className="truncate text-xs text-muted-foreground">
                    Episodio {episode.episodeNumber}: {episode.title}
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="size-3 shrink-0" />
                    {MEDIA_TYPE_LABELS[item.type]}
                  </p>
                )}
                {moment && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3 shrink-0" />
                    {momentLabel} el {moment}
                  </p>
                )}
              </div>
            </Link>

            {action?.(entry)}
          </li>
        );
      })}
    </ul>
  );
}
