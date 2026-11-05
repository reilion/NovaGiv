import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";

import { LibraryEmpty, LibraryShell } from "@/components/library/library-shell";
import { RemoveFromWatchLaterButton } from "@/components/media/remove-from-watch-later-button";
import { VideoEntryList } from "@/components/media/video-entry-list";
import { episodeParam } from "@/lib/episode-param";
import { getWatchLaterVideos } from "@/lib/queries";
import { loginPath } from "@/lib/url";

export const metadata = {
  title: "Ver después | NovaGiv",
};

export default async function WatchLaterPage() {
  const entries = await getWatchLaterVideos();

  if (entries === null) redirect(loginPath("/ver-despues"));

  return (
    <LibraryShell
      active="later"
      description={
        entries.length === 0
          ? "Tu lista está vacía."
          : `${entries.length} ${entries.length === 1 ? "video pendiente" : "videos pendientes"}. Solo tú ves esta lista.`
      }
    >
      {entries.length === 0 ? (
        <LibraryEmpty icon={Bookmark}>
          Pulsa «Ver después» en cualquier video y lo tendrás aquí esperándote.
        </LibraryEmpty>
      ) : (
        <VideoEntryList
          entries={entries}
          momentLabel="Añadido"
          ctaLabel="Ver ahora"
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
    </LibraryShell>
  );
}
