import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Heart, History, ShieldCheck } from "lucide-react";

import { getAccount } from "@/lib/auth";
import { getLikedVideos, getWatchHistory, getWatchLaterVideos } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type LibraryTab = "history" | "later" | "likes";

const TABS: { id: LibraryTab; href: string; label: string; short: string; icon: typeof Heart }[] = [
  { id: "history", href: "/historial", label: "Historial y seguir viendo", short: "Historial", icon: History },
  { id: "later", href: "/ver-despues", label: "Ver después", short: "Ver después", icon: Bookmark },
  { id: "likes", href: "/me-gusta", label: "Mis me gusta", short: "Me gusta", icon: Heart },
];

function formatJoinDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es", { month: "short", year: "numeric" });
}

/**
 * The frame shared by the three personal lists: who you are, how much is on
 * each list, and tabs to move between them. Each page has already checked the
 * session; the three queries are request-cached, so the one a page also renders
 * is not fetched twice.
 */
export async function LibraryShell({
  active,
  description,
  children,
}: {
  active: LibraryTab;
  description: string;
  children: ReactNode;
}) {
  const [account, history, later, likes] = await Promise.all([
    getAccount(),
    getWatchHistory(),
    getWatchLaterVideos(),
    getLikedVideos(),
  ]);

  const counts: Record<LibraryTab, number> = {
    history: history?.length ?? 0,
    later: later?.length ?? 0,
    likes: likes?.length ?? 0,
  };
  const joined = formatJoinDate(account?.createdAt ?? null);
  const current = TABS.find((tab) => tab.id === active)!;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      {/* Phones go back through the «Catálogo» tab. */}
      <Link
        href="/"
        className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
      >
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>

      <header className="relative flex flex-col justify-between gap-4 sm:mt-6 sm:gap-6 sm:overflow-hidden sm:rounded-2xl sm:bg-surface-low sm:p-6 sm:ring-1 sm:ring-border lg:flex-row lg:items-center">
        <div className="pointer-events-none absolute -right-20 -top-20 hidden size-72 rounded-full bg-primary/10 blur-3xl sm:block" />
        <div className="relative flex items-center gap-3 sm:gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-lg font-bold uppercase text-primary ring-1 ring-primary/40 sm:size-16 sm:text-xl">
            {account?.username.slice(0, 2)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl sm:font-bold">
                @{account?.username}
              </h1>
              {account?.role === "admin" && (
                <span className="label-caps rounded bg-surface-high px-1.5 py-0.5 text-primary">
                  NovaGiv Host
                </span>
              )}
              {joined && (
                <span className="label-code hidden text-outline sm:inline">· Miembro desde {joined}</span>
              )}
            </div>
            <p className="hidden items-center gap-1.5 text-sm font-medium text-foreground sm:flex">
              <current.icon className="size-4 text-primary" />
              {current.label}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <dl className="relative grid grid-cols-3 gap-2 sm:gap-8 sm:rounded-xl sm:bg-surface-lowest sm:p-4 sm:px-6">
          <Stat label="Colecciones" value={counts.history} hint="En el historial" icon={History} />
          <Stat label="Favoritos" value={counts.likes} hint="Me gusta" icon={Heart} tone="text-neon" />
          <Stat label="En espera" value={counts.later} hint="Ver después" icon={Bookmark} tone="text-tertiary" />
        </dl>
      </header>

      <nav
        aria-label="Mis listas"
        className="scrollbar-none mt-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-low p-1 ring-1 ring-border sm:mt-6 sm:w-fit"
      >
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                selected
                  ? "bg-surface-high text-primary"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
            >
              <tab.icon className="size-4" />
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span
                className={cn(
                  "label-code rounded-full px-1.5 py-0.5 text-[11px]",
                  selected ? "bg-primary text-primary-foreground" : "bg-surface-highest text-muted-foreground"
                )}
              >
                {counts[tab.id]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 sm:mt-6">{children}</div>

      <p className="mt-6 flex items-start gap-2 rounded-xl bg-surface-low p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px size-4 shrink-0 text-primary" />
        <span>
          Tu lista de <span className="text-primary">Ver después</span> y tu historial son privados.
          Tus <span className="text-tertiary">Me gusta</span> suman de forma anónima al pulso de la
          comunidad en el catálogo de NovaGiv.
        </span>
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Heart;
  tone?: string;
}) {
  return (
    // Phones: a tile each, number first, as in the design; wider screens keep
    // the labelled column inside the header card.
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-low p-3 text-center sm:items-start sm:rounded-none sm:bg-transparent sm:p-0 sm:text-left">
      <dt className={cn("label-caps order-2 flex items-center gap-1.5 text-[10px] sm:order-none sm:text-[11px]", tone)}>
        <Icon className="hidden size-3.5 sm:block" />
        <span className="sm:hidden">{hint}</span>
        <span className="hidden sm:inline">{label}</span>
      </dt>
      <dd className={cn("order-1 text-2xl font-bold sm:order-none sm:text-foreground", tone)}>{value}</dd>
      <dd className="label-code hidden text-outline sm:block">{hint}</dd>
    </div>
  );
}

/** Empty list: what goes here, and the way back to finding something. */
export function LibraryEmpty({ icon: Icon, children }: { icon: typeof Heart; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-low px-4 py-16 text-center ring-1 ring-border">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface">
        <Icon className="size-7 text-primary" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-neon"
      >
        Explorar el catálogo
      </Link>
    </div>
  );
}
