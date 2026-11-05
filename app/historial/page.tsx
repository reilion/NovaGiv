import { redirect } from "next/navigation";
import { History } from "lucide-react";

import { LibraryEmpty, LibraryShell } from "@/components/library/library-shell";
import { RemoveFromHistoryButton } from "@/components/media/remove-from-history-button";
import { VideoEntryList } from "@/components/media/video-entry-list";
import { getWatchHistory } from "@/lib/queries";
import { loginPath } from "@/lib/url";

export const metadata = {
  title: "Historial | NovaGiv",
};

export default async function HistoryPage() {
  const entries = await getWatchHistory();

  if (entries === null) redirect(loginPath("/historial"));

  return (
    <LibraryShell
      active="history"
      description="Una entrada por colección, en el punto donde la dejaste."
    >
      {entries.length === 0 ? (
        <LibraryEmpty icon={History}>Abre cualquier video y podrás retomarlo desde aquí.</LibraryEmpty>
      ) : (
        <VideoEntryList
          entries={entries}
          momentLabel="Visto"
          ctaLabel="Continuar"
          action={(entry) => (
            <RemoveFromHistoryButton mediaItemId={entry.item.id} title={entry.item.title} />
          )}
        />
      )}
    </LibraryShell>
  );
}
