"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type EpisodeInput, upsertMediaItem } from "@/lib/actions/media";
import { slugify } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  isEpisodic,
  MEDIA_STATUS_LABELS,
  MEDIA_TYPE_LABELS,
  type MediaItem,
  type MediaStatus,
  type MediaType,
} from "@/types/media";

interface MediaFormProps {
  item?: MediaItem;
}

interface EpisodeDraft extends EpisodeInput {
  key: string;
}

let draftKeySeq = 0;
function nextDraftKey() {
  draftKeySeq += 1;
  return `draft-${draftKeySeq}`;
}

const MEDIA_TYPES = Object.keys(MEDIA_TYPE_LABELS) as MediaType[];

export function MediaForm({ item }: MediaFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(item?.title ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(item));
  const [type, setType] = useState<MediaType>(item?.type ?? "movie");
  const [posterUrl, setPosterUrl] = useState(item?.posterUrl ?? "");
  const [genresInput, setGenresInput] = useState(item?.genres.join(", ") ?? "");
  const [year, setYear] = useState(item?.year?.toString() ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [rating, setRating] = useState(item?.rating?.toString() ?? "");
  const [duration, setDuration] = useState(item?.duration ?? "");
  const [okRuEmbedUrl, setOkRuEmbedUrl] = useState(item?.okRuEmbedUrl ?? "");
  const [status, setStatus] = useState<MediaStatus>(item?.status ?? "ongoing");
  const [episodes, setEpisodes] = useState<EpisodeDraft[]>(
    () =>
      item?.episodes?.map((episode) => ({
        key: episode.id,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        okRuEmbedUrl: episode.okRuEmbedUrl,
        duration: episode.duration,
      })) ?? []
  );

  const episodic = isEpisodic(type);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function addEpisode() {
    const lastEpisode = episodes[episodes.length - 1];
    setEpisodes([
      ...episodes,
      {
        key: nextDraftKey(),
        seasonNumber: lastEpisode?.seasonNumber,
        episodeNumber: (lastEpisode?.episodeNumber ?? 0) + 1,
        title: "",
        okRuEmbedUrl: "",
        duration: "",
      },
    ]);
  }

  function updateEpisode(key: string, patch: Partial<EpisodeDraft>) {
    setEpisodes((current) => current.map((ep) => (ep.key === key ? { ...ep, ...patch } : ep)));
  }

  function removeEpisode(key: string) {
    setEpisodes((current) => current.filter((ep) => ep.key !== key));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (episodic && episodes.length === 0) {
      setError("Añade al menos un episodio.");
      return;
    }
    if (episodic && episodes.some((ep) => !ep.title.trim() || !ep.okRuEmbedUrl.trim())) {
      setError("Cada episodio necesita título y URL de embed.");
      return;
    }
    if (!episodic && !okRuEmbedUrl.trim()) {
      setError("La URL de embed es obligatoria.");
      return;
    }

    startTransition(async () => {
      const result = await upsertMediaItem({
        id: item?.id,
        title,
        slug,
        type,
        posterUrl,
        genres: genresInput
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean),
        year: year ? Number(year) : undefined,
        description: description || undefined,
        rating: rating ? Number(rating) : undefined,
        duration: episodic ? undefined : duration || undefined,
        okRuEmbedUrl: episodic ? undefined : okRuEmbedUrl || undefined,
        status: episodic ? status : undefined,
        episodes: episodic
          ? episodes.map((episode) => ({
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              title: episode.title,
              okRuEmbedUrl: episode.okRuEmbedUrl,
              duration: episode.duration,
            }))
          : [],
      });

      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-16">
      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
          <CardDescription>Información base del título, visible en el catálogo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" htmlFor="title" className="sm:col-span-2">
            <Input
              id="title"
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              required
            />
          </Field>

          <Field label="Slug (URL)" htmlFor="slug">
            <Input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              required
            />
          </Field>

          <Field label="Tipo" htmlFor="type">
            <Select value={type} onValueChange={(value) => setType(value as MediaType)}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue>{MEDIA_TYPE_LABELS[type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {MEDIA_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Año" htmlFor="year">
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </Field>

          <Field label="Calificación (0-10)" htmlFor="rating">
            <Input
              id="rating"
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            />
          </Field>

          <Field label="Géneros (separados por coma)" htmlFor="genres" className="sm:col-span-2">
            <Input
              id="genres"
              value={genresInput}
              onChange={(event) => setGenresInput(event.target.value)}
              placeholder="Fantasía, Aventura"
            />
          </Field>

          <Field
            label="URL del póster"
            htmlFor="posterUrl"
            hint="Debe alojarse en Supabase Storage o un dominio permitido en next.config.ts (images.remotePatterns)."
            className="sm:col-span-2"
          >
            <Input
              id="posterUrl"
              value={posterUrl}
              onChange={(event) => setPosterUrl(event.target.value)}
              placeholder="https://..."
              required
            />
          </Field>

          <Field label="Descripción" htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      {episodic ? (
        <Card>
          <CardHeader>
            <CardTitle>Episodios</CardTitle>
            <CardDescription>
              Se agrupan automáticamente por temporada en el reproductor. Deja el número
              de temporada vacío si el título tiene una sola.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Estado" htmlFor="status" className="max-w-xs">
              <Select value={status} onValueChange={(value) => setStatus(value as MediaStatus)}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue>{MEDIA_STATUS_LABELS[status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ongoing">{MEDIA_STATUS_LABELS.ongoing}</SelectItem>
                  <SelectItem value="completed">{MEDIA_STATUS_LABELS.completed}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex flex-col gap-3">
              {episodes.map((episode) => (
                <div
                  key={episode.key}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-6"
                >
                  <Field label="Temporada" htmlFor={`season-${episode.key}`}>
                    <Input
                      id={`season-${episode.key}`}
                      type="number"
                      min={1}
                      value={episode.seasonNumber ?? ""}
                      onChange={(event) =>
                        updateEpisode(episode.key, {
                          seasonNumber: event.target.value ? Number(event.target.value) : undefined,
                        })
                      }
                    />
                  </Field>
                  <Field label="Episodio #" htmlFor={`number-${episode.key}`}>
                    <Input
                      id={`number-${episode.key}`}
                      type="number"
                      min={1}
                      value={episode.episodeNumber}
                      onChange={(event) =>
                        updateEpisode(episode.key, { episodeNumber: Number(event.target.value) })
                      }
                      required
                    />
                  </Field>
                  <Field
                    label="Título"
                    htmlFor={`title-${episode.key}`}
                    className="col-span-2 sm:col-span-2"
                  >
                    <Input
                      id={`title-${episode.key}`}
                      value={episode.title}
                      onChange={(event) => updateEpisode(episode.key, { title: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Duración" htmlFor={`duration-${episode.key}`}>
                    <Input
                      id={`duration-${episode.key}`}
                      value={episode.duration ?? ""}
                      onChange={(event) =>
                        updateEpisode(episode.key, { duration: event.target.value })
                      }
                      placeholder="24m"
                    />
                  </Field>
                  <div className="flex items-end justify-between gap-2 sm:col-span-6">
                    <Field
                      label="URL de embed (ok.ru)"
                      htmlFor={`embed-${episode.key}`}
                      hint="Si pegas el enlace normal (ok.ru/video/...) se convierte solo al guardar."
                      className="flex-1"
                    >
                      <Input
                        id={`embed-${episode.key}`}
                        value={episode.okRuEmbedUrl}
                        onChange={(event) =>
                          updateEpisode(episode.key, { okRuEmbedUrl: event.target.value })
                        }
                        placeholder="https://ok.ru/videoembed/..."
                        required
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mb-0.5 shrink-0"
                      onClick={() => removeEpisode(episode.key)}
                      aria-label="Eliminar episodio"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addEpisode} className="self-start">
              <Plus className="size-4" />
              Añadir episodio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Video</CardTitle>
            <CardDescription>
              Para películas, especiales/votaciones y karaokes (un solo embed).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Duración" htmlFor="duration">
              <Input
                id="duration"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="1h 52m"
              />
            </Field>
            <Field
              label="URL de embed (ok.ru)"
              htmlFor="okRuEmbedUrl"
              hint="Si pegas el enlace normal (ok.ru/video/...) se convierte solo al guardar."
            >
              <Input
                id="okRuEmbedUrl"
                value={okRuEmbedUrl}
                onChange={(event) => setOkRuEmbedUrl(event.target.value)}
                placeholder="https://ok.ru/videoembed/..."
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : item ? "Guardar cambios" : "Crear título"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
