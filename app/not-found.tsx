import Link from "next/link";
import { SearchX } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Página no encontrada | NovaGiv",
};

/**
 * Also what a title renders when its slug no longer resolves — unpublished or
 * deleted since somebody shared the link (see lib/media-view.ts).
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Aquí no hay nada
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          El enlace puede estar mal escrito, o el título que buscas ya no está publicado.
        </p>
      </div>
      <Link href="/" className={buttonVariants()}>
        Volver al catálogo
      </Link>
    </div>
  );
}
