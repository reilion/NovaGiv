import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CloudDownload, Eye, Film, Heart, Layers, Link2, Pencil, Plus } from "lucide-react";

import { DeleteMediaButton } from "@/components/admin/delete-media-button";
import { PublishToggleButton } from "@/components/admin/publish-toggle-button";
import { SeedButton } from "@/components/admin/seed-button";
import { buttonVariants } from "@/components/ui/button";
import { getAllMediaItemsForAdmin } from "@/lib/queries";
import { formatStreamRange } from "@/lib/stream-date";
import { formatViews } from "@/lib/text";
import { cn } from "@/lib/utils";
import { isEpisodic, MEDIA_TYPE_TAGS, totalLikesOf, totalViewsOf, type MediaType } from "@/types/media";

const TYPE_TONE: Record<MediaType, string> = {
  movie: "bg-live/20 text-tertiary",
  series: "bg-primary/20 text-primary",
  anime: "bg-primary/20 text-primary",
  special: "bg-neon/20 text-neon",
  karaoke: "bg-neon/20 text-neon",
};

// There used to be a banner here for "Supabase is not configured, these are
// demo titles". It cannot happen any more: reaching this page needs an admin
// account, and without a project nobody has one — the layout above sends them
// to /login, which is where that explanation lives now.
export default async function AdminDashboardPage() {
  const items = await getAllMediaItemsForAdmin();

  const drafts = items.filter((item) => item.published === false).length;
  const episodes = items.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0);
  const views = items.reduce((sum, item) => sum + (totalViewsOf(item) ?? 0), 0);
  const likes = items.reduce((sum, item) => sum + totalLikesOf(item), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div className="flex flex-col gap-2">
          <p className="label-caps text-primary">NovaGiv CMS · Control Studio</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Gestión del catálogo
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Importa transmisiones desde ok.ru, edita episodios, publica borradores y revisa las
            reproducciones privadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeedButton />
          {/* Links styled as buttons, not Buttons rendering links: Base UI's
              Button insists on a native <button>. */}
          <Link href="/admin/import" className={cn(buttonVariants(), "h-10 px-4 font-semibold")}>
            <CloudDownload className="size-4" />
            Importar desde ok.ru
          </Link>
          <Link
            href="/admin/media/new"
            className={cn(buttonVariants({ variant: "secondary" }), "h-10 bg-surface-high px-4")}
          >
            <Plus className="size-4" />
            Nueva colección
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Inventario" icon={<Film className="size-4" />} value={items.length} unit="títulos">
          <span className="label-code text-foreground">{items.length - drafts} publicados</span>
          <span className={cn("label-code rounded px-1.5 py-0.5", drafts > 0 ? "bg-live/20 text-tertiary" : "text-outline")}>
            {drafts} borradores
          </span>
        </StatCard>
        <StatCard label="Episodios" icon={<Layers className="size-4" />} value={episodes} unit="videos">
          <span className="text-xs text-muted-foreground">Repartidos en series y anime</span>
        </StatCard>
        <StatCard label="Vistas privadas" icon={<Eye className="size-4" />} value={formatViews(views)} unit="reproducciones">
          <span className="text-xs text-muted-foreground">Solo visibles para administradores</span>
        </StatCard>
        <StatCard
          label="Me gusta"
          icon={<Heart className="size-4" />}
          value={formatViews(likes)}
          unit="totales"
          tone="text-neon"
        >
          <span className="text-xs text-muted-foreground">Suma de todos los videos</span>
        </StatCard>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-low ring-1 ring-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Catálogo general</h2>
          <span className="label-code rounded bg-surface-high px-1.5 py-0.5 text-muted-foreground">
            {items.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          {/* Fixed layout so the widths below are what the columns get: the
              title column holds 30% and long names wrap inside it, which keeps
              the whole table on screen instead of scrolling sideways. */}
          <table className="w-full min-w-[56rem] table-fixed text-sm">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[10%]" />
              <col className="w-[17%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="label-caps bg-surface-lowest/60 text-left text-outline">
              <tr>
                <th className="px-3 py-3 font-semibold">Contenido / slug</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Rango stream</th>
                <th className="px-3 py-3 font-semibold">Metraje</th>
                <th className="px-3 py-3 font-semibold">Engagement</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const draft = item.published === false;
                const itemViews = totalViewsOf(item);
                const range = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt, { short: true });

                return (
                  <tr
                    key={item.id}
                    className={cn("transition-colors hover:bg-surface", draft && "bg-live/[0.04]")}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded bg-surface">
                          <Image src={item.posterUrl} alt="" fill sizes="36px" className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold leading-snug text-foreground">
                            <span className="break-words [overflow-wrap:anywhere]">{item.title}</span>
                            {draft && (
                              <span className="label-caps shrink-0 rounded bg-live/20 px-1 py-px text-[10px] text-tertiary">
                                Borrador
                              </span>
                            )}
                          </p>
                          <p className="label-code break-all text-[11px] text-muted-foreground">/v/{item.slug}</p>
                          {item.okruChannelName && (
                            <p className="label-code flex items-start gap-1 text-[11px] text-outline [overflow-wrap:anywhere]">
                              <Link2 className="mt-0.5 size-3 shrink-0" />
                              {item.okruChannelName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("label-caps rounded px-1.5 py-0.5", TYPE_TONE[item.type])}>
                        {MEDIA_TYPE_TAGS[item.type]}
                      </span>
                    </td>
                    <td className="label-code px-3 py-3 text-muted-foreground">{range || "—"}</td>
                    <td className="label-code px-3 py-3 text-muted-foreground">
                      {isEpisodic(item.type) ? `${item.episodes?.length ?? 0} ep.` : (item.duration ?? "1 video")}
                    </td>
                    <td className="label-code px-3 py-3">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-neon">
                          <Heart className="size-3.5" />
                          {formatViews(totalLikesOf(item))}
                        </span>
                        {itemViews !== undefined && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Eye className="size-3.5" />
                            {formatViews(itemViews)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <PublishToggleButton id={item.id} published={!draft} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/media/${item.id}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          aria-label={`Editar ${item.title}`}
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <DeleteMediaButton id={item.id} title={item.title} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Sin títulos todavía. Usa &ldquo;Sembrar datos de ejemplo&rdquo;, &ldquo;Importar
                    desde ok.ru&rdquo; o crea uno nuevo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  icon,
  value,
  unit,
  tone = "text-primary",
  children,
}: {
  label: string;
  icon: ReactNode;
  value: number | string;
  unit: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl bg-surface-low p-4 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <p className="label-caps text-outline">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg bg-surface", tone)}>
          {icon}
        </span>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
        <span className={cn("label-code", tone)}>{unit}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
