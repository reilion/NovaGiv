"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ban,
  CircleCheck,
  CirclePlus,
  KeyRound,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listOkRuSyncChannels, syncOkRuChannelNow } from "@/lib/actions/okru-import";
import { OKRU_SYNC_CHANNEL_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SyncChannel, SyncOutcome } from "@/lib/okru-sync";

/** One row of the report: a channel and what syncing it did. */
interface ChannelProgress {
  channel: SyncChannel;
  outcome?: SyncOutcome;
  error?: string;
}

/**
 * The same incremental import as `pnpm okru:sync`, run from the browser over
 * the most recent channels of the profile.
 *
 * The loop lives here rather than in one server action so the report fills in
 * channel by channel while it runs, and no single request has to cover all of
 * them. What each channel does to the catalog is decided server-side by
 * lib/okru-sync.ts — the very code the CLI uses.
 */
export function OkRuImportPanel({ hasSession }: { hasSession: boolean }) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ChannelProgress[]>([]);
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(false);

  async function handleSync() {
    setIsRunning(true);
    setError(null);
    setProgress([]);
    setTotal(0);
    setFinished(false);

    const listed = await listOkRuSyncChannels();
    if (listed.error || !listed.channels) {
      setError(listed.error ?? "No se pudieron leer los canales de ok.ru.");
      setIsRunning(false);
      return;
    }

    setTotal(listed.channels.length);

    // One at a time: ok.ru is being scraped, and each result should land on
    // screen as soon as it's known.
    for (const channel of listed.channels) {
      const result = await syncOkRuChannelNow(channel);
      setProgress((current) => [
        ...current,
        { channel, outcome: result.outcome, error: result.error },
      ]);
    }

    setIsRunning(false);
    setFinished(true);
  }

  const summary = summarise(progress);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Sincronizar los últimos {OKRU_SYNC_CHANNEL_LIMIT} canales</CardTitle>
            <Badge variant={hasSession ? "default" : "outline"} className="gap-1">
              <KeyRound className="size-3" />
              {hasSession ? "Con tu sesión" : "Sin sesión"}
            </Badge>
          </div>
          <CardDescription>
            Recorre los {OKRU_SYNC_CHANNEL_LIMIT} canales más recientes del perfil: crea como
            borrador los que aún no existen y a los que ya existen solo les añade los videos
            nuevos. Nunca toca el título, el póster ni los episodios que ya editaste.{" "}
            {hasSession
              ? "Usando tu cookie de ok.ru: también ve los canales privados/solo amigos."
              : "Solo lee la página pública, así que los canales privados o solo-amigos no aparecerán (configura OKRU_COOKIE en .env.local para verlos)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Alcance de esta pantalla:</strong> ok.ru entrega
            sus listas de 20 en 20 y pedir el resto necesita un token que solo genera su
            JavaScript. Por eso aquí se sincronizan los {OKRU_SYNC_CHANNEL_LIMIT} canales que
            salen sin hacer scroll y, de cada uno, sus 20 videos más recientes. Para el catálogo
            completo (todos los canales y todos sus videos) ejecuta <code>pnpm okru:sync</code>{" "}
            en tu PC.
          </div>

          <div>
            <Button type="button" onClick={handleSync} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {isRunning ? "Sincronizando…" : "Sincronizar ahora"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {isRunning && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {total === 0
                ? "Leyendo los canales del perfil…"
                : `Canal ${Math.min(progress.length + 1, total)} de ${total}…`}
            </p>
          )}

          {finished && progress.length > 0 && (
            <p className="text-sm text-foreground">
              Listo. Creadas: {summary.created} · Con videos nuevos: {summary.updated} · Sin
              cambios: {summary.unchanged} · Omitidas: {summary.skipped}
              {summary.created + summary.updated > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  — las nuevas quedan como borrador hasta que las publiques.
                </span>
              )}
            </p>
          )}

          {progress.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {progress.map((row) => (
                <ProgressRow key={row.channel.id} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressRow({ row }: { row: ChannelProgress }) {
  const { icon, text, tone, mediaItemId } = describe(row);

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <span className={cn("shrink-0", tone)}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{row.channel.name}</span>{" "}
        <span className="text-muted-foreground">{text}</span>
      </span>
      {mediaItemId && (
        <Link
          href={`/admin/media/${mediaItemId}`}
          className="shrink-0 text-xs text-primary underline-offset-4 hover:underline"
        >
          Editar
        </Link>
      )}
    </li>
  );
}

/** The line the CLI would print, as an icon + a sentence. */
function describe(row: ChannelProgress): {
  icon: React.ReactNode;
  text: string;
  tone: string;
  mediaItemId?: string;
} {
  if (row.error || !row.outcome) {
    return {
      icon: <TriangleAlert className="size-4" />,
      text: row.error ?? "No se pudo sincronizar.",
      tone: "text-destructive",
    };
  }

  const outcome = row.outcome;
  switch (outcome.status) {
    case "created":
      return {
        icon: <CirclePlus className="size-4" />,
        text: `colección nueva · ${outcome.added} episodio${outcome.added === 1 ? "" : "s"} · borrador`,
        tone: "text-primary",
        mediaItemId: outcome.mediaItemId,
      };
    case "updated":
      return {
        icon: <CirclePlus className="size-4" />,
        text:
          `+${outcome.added} episodio${outcome.added === 1 ? "" : "s"} (total ${outcome.total})` +
          (outcome.published ? "" : " · sigue en borrador"),
        tone: "text-primary",
        mediaItemId: outcome.mediaItemId,
      };
    case "unchanged":
      return {
        icon: <CircleCheck className="size-4" />,
        text: `sin videos nuevos (${outcome.total} episodios)${
          outcome.collections > 1 ? ` · ${outcome.collections} colecciones del canal` : ""
        }`,
        tone: "text-muted-foreground",
        mediaItemId: outcome.mediaItemId,
      };
    case "skipped":
      return {
        icon: <Ban className="size-4" />,
        text: `${outcome.reason}, se omite`,
        tone: "text-muted-foreground",
      };
    case "error":
      return {
        icon: <TriangleAlert className="size-4" />,
        text: outcome.message,
        tone: "text-destructive",
      };
  }
}

function summarise(progress: ChannelProgress[]) {
  const summary = { created: 0, updated: 0, unchanged: 0, skipped: 0 };

  for (const row of progress) {
    if (!row.outcome || row.error || row.outcome.status === "error") summary.skipped += 1;
    else summary[row.outcome.status] += 1;
  }

  return summary;
}
