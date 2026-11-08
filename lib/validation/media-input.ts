import { z } from "zod";

import { isAllowedImageUrl } from "@/lib/image-hosts";
import { toOkRuEmbedUrl } from "@/lib/okru";
import type { MediaFormInput } from "@/types/media";

/**
 * Runtime check of what the admin form sends to the server.
 *
 * A Server Action is a public POST endpoint: TypeScript's `MediaFormInput`
 * does not exist at runtime, and the action receives whatever the request
 * carries. This is what stands between that and the database — and, because
 * the embed URL ends up as the `src` of the public player's <iframe> and the
 * poster as the source of every card, between that and every visitor.
 *
 * Bounds are generous (several times the largest value in the catalog today);
 * they are there to refuse nonsense, not to second-guess the admin.
 */

/** Trims, and turns "" into undefined, so an emptied field reads as unset. */
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().max(max).optional()
  );

/** "2026-07-28", "2026-07-28T00:19" or "2026-07-28T00:19:09" — wall-clock, no zone. */
const streamDate = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/, "Fecha de stream no válida.")
    .optional()
);

/** Any ok.ru link the admin may paste, stored as the embeddable form. */
const okRuEmbedUrl = z
  .string()
  .trim()
  .min(1, "Falta la URL de ok.ru.")
  .transform((value) => toOkRuEmbedUrl(value))
  .refine((value) => /^https:\/\/ok\.ru\/videoembed\/\d+(\?[\w=&%-]*)?$/.test(value), {
    message: "La URL del video debe ser un enlace de ok.ru (ok.ru/video/… u ok.ru/videoembed/…).",
  });

/** Not optimized (see components/player/media-player.tsx), so any https host will do. */
const thumbnailUrl = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.url({ protocol: /^https$/, error: "La miniatura debe ser una URL https." }).max(2048).optional()
);

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === null || value === "" || Number.isNaN(value) ? undefined : value),
    schema.optional()
  );

const episodeSchema = z.object({
  seasonNumber: optionalNumber(z.number().int().min(1).max(100)),
  episodeNumber: z.number().int().min(0).max(100_000),
  title: z.string().trim().min(1, "Cada episodio necesita un título.").max(300),
  okRuEmbedUrl,
  duration: optionalText(50),
  thumbnailUrl,
  streamedAt: streamDate,
  claimedFromEpisodeId: z.uuid().optional(),
});

const channelSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  url: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z
      .url({ protocol: /^https$/, hostname: /^(m\.)?ok\.ru$/ })
      .optional()
  ),
});

export const mediaFormInputSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "El título es obligatorio.").max(300),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio.")
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "El slug solo puede tener letras, números y guiones."),
  type: z.enum(["movie", "series", "anime", "special", "karaoke"]),
  posterUrl: z
    .string()
    .trim()
    .min(1, "La URL del póster es obligatoria.")
    .refine(isAllowedImageUrl, {
      message:
        "Ese dominio de póster no está permitido. Usa MyAnimeList, AniList, IMDb, TMDB, ok.ru o Supabase Storage (o añádelo en lib/image-hosts.ts).",
    }),
  genres: z.array(z.string().trim().min(1).max(60)).max(30),
  year: optionalNumber(z.number().int().min(1900).max(2100)),
  description: optionalText(5000),
  duration: optionalText(50),
  okRuEmbedUrl: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    okRuEmbedUrl.optional()
  ),
  status: z.enum(["ongoing", "completed"]).optional(),
  rating: optionalNumber(z.number().min(0).max(10)),
  published: z.boolean(),
  episodes: z.array(episodeSchema).max(2000, "Demasiados episodios en una sola colección."),
  streamedAt: streamDate,
  okruChannel: channelSchema.nullable().optional(),
});

/**
 * The input, checked and normalized (trimmed, embed URLs rewritten), or the
 * first problem as a message the form can show.
 */
export function parseMediaFormInput(
  input: unknown
): { data: MediaFormInput; error?: undefined } | { data?: undefined; error: string } {
  const result = mediaFormInputSchema.safeParse(input);
  if (result.success) return { data: result.data as MediaFormInput };

  const issue = result.error.issues[0];
  const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
  return { error: `${issue?.message ?? "Datos no válidos."}${where}` };
}
