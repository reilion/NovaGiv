import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, Heart } from "lucide-react";

import { RemoveFromHistoryButton } from "@/components/media/remove-from-history-button";
import { VideoEntryList } from "@/components/media/video-entry-list";
import { buttonVariants } from "@/components/ui/button";
import { getWatchHistory } from "@/lib/queries";
import { loginPath } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Historial | NovaGiv",
};

export default async function HistoryPage() {
  const entries = await getWatchHistory();

  if (entries === null) redirect(loginPath("/historial"));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Clock className="size-5 text-primary" />
            Historial
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length === 0
              ? "Aquí aparecerá lo que vayas viendo."
              : "Una entrada por colección, en el punto donde la dejaste."}
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
            <Clock className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Abre cualquier video y podrás retomarlo desde aquí.
            </p>
            <Link href="/" className={buttonVariants({ size: "sm" })}>
              Explorar el catálogo
            </Link>
          </div>
        ) : (
          <VideoEntryList
            entries={entries}
            momentLabel="Visto"
            action={(entry) => (
              <RemoveFromHistoryButton mediaItemId={entry.item.id} title={entry.item.title} />
            )}
          />
        )}
      </div>
    </div>
  );
}
