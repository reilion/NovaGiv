import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { DeleteMediaButton } from "@/components/admin/delete-media-button";
import { SeedButton } from "@/components/admin/seed-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMediaItems, isSupabaseConfigured } from "@/lib/queries";
import { isEpisodic, MEDIA_TYPE_LABELS } from "@/types/media";

export default async function AdminDashboardPage() {
  const items = await getMediaItems();

  return (
    <div className="flex flex-col gap-6">
      {!isSupabaseConfigured && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Supabase no está configurado (faltan <code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en <code>.env.local</code>). Estos
          títulos son datos de ejemplo y no se pueden editar todavía.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Catálogo</h1>
          <p className="text-sm text-muted-foreground">{items.length} títulos en la base de datos.</p>
        </div>
        <div className="flex items-center gap-2">
          <SeedButton />
          <Button render={<Link href="/admin/media/new" />}>
            <Plus className="size-4" />
            Nuevo título
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Año</th>
              <th className="px-4 py-3 font-medium">Episodios</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-foreground">{item.title}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{MEDIA_TYPE_LABELS[item.type]}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.year ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {isEpisodic(item.type) ? (item.episodes?.length ?? 0) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      render={<Link href={`/admin/media/${item.id}`} />}
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${item.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteMediaButton id={item.id} title={item.title} />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Sin títulos todavía. Usa &ldquo;Sembrar datos de ejemplo&rdquo; o crea uno
                  nuevo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
