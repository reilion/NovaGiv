import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark, Clock, Heart } from "lucide-react";

import { VideoEntryList } from "@/components/media/video-entry-list";
import { buttonVariants } from "@/components/ui/button";
import { getLikedVideos } from "@/lib/queries";
import { loginPath } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Mis me gusta | NovaGiv",
};

export default async function LikedVideosPage() {
  const entries = await getLikedVideos();

  // null is "no session", which is the whole reason this page is private.
  if (entries === null) redirect(loginPath("/me-gusta"));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Heart className="size-5 text-primary" />
            Mis me gusta
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length === 0
              ? "Todavía no has guardado ningún video."
              : `${entries.length} ${entries.length === 1 ? "video guardado" : "videos guardados"}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/ver-despues" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Bookmark className="size-4" />
            Ver después
          </Link>
          <Link href="/historial" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Clock className="size-4" />
            Historial
          </Link>
        </div>
      </header>

      <div className="mt-6">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-4 py-16 text-center ring-1 ring-foreground/10">
            <Heart className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Dale al corazón en cualquier video y aparecerá aquí.
            </p>
            <Link href="/" className={buttonVariants({ size: "sm" })}>
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          <VideoEntryList entries={entries} momentLabel="Guardado" />
        )}
      </div>
    </div>
  );
}
