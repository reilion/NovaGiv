import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A nudge for visitors without an account: what signing up keeps for them.
 * Presentational only — whoever renders it has already checked the session.
 */
export function GuestSyncBanner({
  title = "¿Guardar tu progreso?",
  description = "Crea tu cuenta para no perder tu historial.",
  href = "/register",
  cta = "Crear",
  className,
}: {
  title?: string;
  description?: string;
  href?: string;
  cta?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl bg-surface p-2 shadow-md",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <RefreshCw className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Link
        href={href}
        className="label-caps shrink-0 rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground transition-transform active:scale-95"
      >
        {cta}
      </Link>
    </div>
  );
}
