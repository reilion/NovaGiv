import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Play } from "lucide-react";

import { episodeParam } from "@/lib/episode-param";
import type { VideoEntry } from "@/lib/queries";
import { formatStreamDate } from "@/lib/stream-date";
import { MEDIA_STATUS_LABELS, MEDIA_TYPE_TAGS } from "@/types/media";

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

  return date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

interface VideoEntryListProps {
  entries: VideoEntry[];
  /** What the date on each row means — "Guardado" / "Visto". */
  momentLabel: string;
  /** The label of the button that opens the video — "Continuar", "Ver ahora". */
  ctaLabel: string;
  /** Optional control on the right of a row, e.g. removing it. */
  action?: (entry: VideoEntry) => ReactNode;
}

/**
 * The rows of "Mis me gusta", "Ver después" and the history: one video each,
 * linking straight to it — the episode included, through the same `?ep=` the
 * player writes.
 */
export function VideoEntryList({ entries, momentLabel, ctaLabel, action }: VideoEntryListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => {
        const { item, episode } = entry;
        const href = videoEntryHref(entry);
        const moment = formatMoment(entry.at);
        const streamedAt = episode?.streamedAt ?? item.firstStreamedAt;
        const episodeCount = item.episodes?.length ?? 0;

        const tag = episode
          ? [
              episode.seasonNumber ? `T${episode.seasonNumber}` : null,
              `Ep. ${episode.episodeNumber}${episodeCount > 0 ? ` de ${episodeCount}` : ""}`,
            ]
              .filter(Boolean)
              .join(" • ")
          : item.duration
            ? `${MEDIA_TYPE_TAGS[item.type]} • ${item.duration}`
            : MEDIA_TYPE_TAGS[item.type];

        return (
          <li
            key={videoEntryKey(entry)}
            className="group/row flex flex-col gap-4 rounded-xl bg-surface-low p-3 ring-1 ring-border transition-colors hover:bg-surface sm:flex-row sm:items-center sm:p-4"
          >
            <Link
              href={href}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-surface ring-1 ring-border sm:w-20">
                <Image src={item.posterUrl} alt="" fill sizes="80px" className="object-cover" />
                <span className="label-caps absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4 text-[9px] text-foreground">
                  {MEDIA_TYPE_TAGS[item.type]}
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="label-caps rounded bg-surface-high px-1.5 py-0.5 text-primary">
                    {tag}
                  </span>
                  {item.status && episode && (
                    <span className="label-code text-[11px] text-neon">
                      {MEDIA_STATUS_LABELS[item.status]}
                    </span>
                  )}
                </div>
                <p className="truncate text-base font-bold text-foreground sm:text-lg">{item.title}</p>
                {episode && (
                  <p className="truncate text-sm text-muted-foreground">
                    Episodio {episode.episodeNumber}: {episode.title}
                  </p>
                )}
                <p className="label-code flex flex-wrap items-center gap-x-1.5 text-[11px] text-outline">
                  <CalendarDays className="size-3 shrink-0" />
                  {streamedAt && <span>Transmitido el {formatStreamDate(streamedAt)}</span>}
                  {streamedAt && moment && <span aria-hidden>·</span>}
                  {moment && (
                    <span>
                      {momentLabel} el {moment}
                    </span>
                  )}
                </p>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
              <Link
                href={href}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_16px_-4px_rgba(208,188,255,0.4)] transition-colors hover:bg-neon"
              >
                <Play className="size-4 fill-current" />
                {ctaLabel}
              </Link>
              {action?.(entry)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
