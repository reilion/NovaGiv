import { redirect } from "next/navigation";
import { Heart } from "lucide-react";

import { LibraryEmpty, LibraryShell } from "@/components/library/library-shell";
import { VideoEntryList } from "@/components/media/video-entry-list";
import { getLikedVideos } from "@/lib/queries";
import { loginPath } from "@/lib/url";

export const metadata = {
  title: "Mis me gusta | NovaGiv",
};

export default async function LikedVideosPage() {
  const entries = await getLikedVideos();

  // null is "no session", which is the whole reason this page is private.
  if (entries === null) redirect(loginPath("/me-gusta"));

  return (
    <LibraryShell
      active="likes"
      description={
        entries.length === 0
          ? "Todavía no le has dado me gusta a ningún video."
          : `${entries.length} ${entries.length === 1 ? "video que te gustó" : "videos que te gustaron"}.`
      }
    >
      {entries.length === 0 ? (
        <LibraryEmpty icon={Heart}>Dale al corazón en cualquier video y aparecerá aquí.</LibraryEmpty>
      ) : (
        <VideoEntryList entries={entries} momentLabel="Te gustó" ctaLabel="Ver de nuevo" />
      )}
    </LibraryShell>
  );
}
