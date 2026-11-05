import Link from "next/link";
import { Clapperboard } from "lucide-react";

import { cn } from "@/lib/utils";

/** The NovaGiv logo: a glowing tile plus the wordmark. */
export function BrandMark({
  href = "/",
  suffix,
  className,
}: {
  href?: string;
  /** Second word after the name, e.g. «Studio» in /admin. */
  suffix?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/brand flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="relative flex size-9 items-center justify-center rounded-lg bg-surface">
        <span className="pointer-events-none absolute -inset-1 rounded-xl bg-primary/20 blur-sm transition-opacity group-hover/brand:opacity-100 opacity-60" />
        <Clapperboard className="relative size-5 text-primary" />
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">
        NovaGiv
        {suffix && <span className="ml-1.5 font-semibold text-muted-foreground">{suffix}</span>}
      </span>
    </Link>
  );
}
