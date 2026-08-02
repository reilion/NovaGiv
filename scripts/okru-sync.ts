/**
 * Imports every ok.ru channel (and all of its videos) from the streamer's
 * profile into Supabase as unpublished drafts, ready to be renamed/completed
 * and published from /admin.
 *
 * Re-runs are incremental: collections are matched by the ok.ru channel id
 * stored in `media_items.okru_channel_id`, never by title or slug, so a
 * collection renamed in /admin is still recognised. For those, the script only
 * appends the videos that aren't in the database yet — every field the admin
 * edited (title, poster, genres, episode titles, published state…) is left
 * alone.
 *
 * Run locally:  pnpm okru:sync
 *               pnpm okru:sync --dry-run   (scrape + report, write nothing)
 *               pnpm okru:sync --limit 5   (only the first N channels)
 *
 * Why a local script instead of a button in /admin:
 * ok.ru lazy-loads both the channel grid and each channel's video grid in
 * pages of 20, and the "load more" request requires a `tkn` header that the
 * site generates in JavaScript and rotates on every page load. A plain fetch
 * therefore caps out at the first 20 of each list, so a real browser
 * (Playwright) is required. Scrolling the full catalogue takes minutes, which
 * would exceed Vercel's serverless function timeout — hence: run it here.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium, type BrowserContext, type Page } from "playwright";

import { formatStreamDate, formatStreamRange, parseStreamTitle } from "@/lib/stream-date";

config({ path: ".env.local" });

const PROFILE_URL =
  process.env.OKRU_PROFILE_URL ?? "https://ok.ru/profile/597703328549/video/channels";
const COOKIE = process.env.OKRU_COOKIE;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SUPABASE_ADMIN_PASSWORD;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return Infinity;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : Infinity;
})();
/** `--channel c12345` restricts the run to one channel (handy for re-syncing). */
const ONLY_CHANNEL = (() => {
  const idx = process.argv.indexOf("--channel");
  return idx === -1 ? null : (process.argv[idx + 1] ?? null);
})();

interface ScrapedChannel {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  videoCount?: number;
}

interface ScrapedVideo {
  id: string;
  title: string;
  duration?: string;
  thumbnailUrl?: string;
  /** Parsed from the ok.ru title; absent when the title carries no date. */
  streamedAt?: string;
}

/** The subset of an existing collection this script needs to decide what to do with it. */
interface ExistingMediaItem {
  id: string;
  title: string;
  published: boolean;
  okru_channel_id: string | null;
  okru_channel_name: string | null;
  okru_channel_primary: boolean;
}

interface ExistingEpisode {
  episode_number: number;
  season_number: number | null;
  okru_embed_url: string;
  streamed_at: string | null;
}

const VIDEO_ID_IN_EMBED = /\/videoembed\/(\d+)/;

function videoIdFromEmbedUrl(url: string): string | null {
  return url.match(VIDEO_ID_IN_EMBED)?.[1] ?? null;
}

/** Earliest/latest of a set of "YYYY-MM-DD…" strings — lexicographic order is chronological. */
function streamRangeOf(dates: (string | null | undefined)[]): [string | null, string | null] {
  const sorted = dates.filter((date): date is string => Boolean(date)).sort();
  return [sorted[0] ?? null, sorted[sorted.length - 1] ?? null];
}

/**
 * Where to continue numbering when appending videos to a collection that
 * already has episodes: after the last one, inside its season, so the
 * (media_item_id, season_number, episode_number) unique constraint holds and
 * seasons the admin set up stay intact.
 */
function nextEpisodeSlot(episodes: ExistingEpisode[]): {
  seasonNumber: number | null;
  episodeNumber: number;
} {
  if (episodes.length === 0) return { seasonNumber: null, episodeNumber: 1 };

  const last = [...episodes].sort(
    (a, b) =>
      (a.season_number ?? 0) - (b.season_number ?? 0) || a.episode_number - b.episode_number
  )[episodes.length - 1];

  const highestInSeason = episodes
    .filter((episode) => episode.season_number === last.season_number)
    .reduce((max, episode) => Math.max(max, episode.episode_number), 0);

  return { seasonNumber: last.season_number, episodeNumber: highestInSeason + 1 };
}

/**
 * The catalog tables only allow writes to the `authenticated` role, so the
 * anon key alone is not enough. Either supply a service-role key, or the
 * admin account's credentials so the script can sign in as that user.
 */
async function createWritableClient() {
  if (!COOKIE) {
    console.error("Falta OKRU_COOKIE en .env.local");
    process.exit(1);
  }

  // --dry-run only scrapes and reports, so no Supabase credentials are needed.
  if (DRY_RUN) return null;

  if (!SUPABASE_URL) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
    process.exit(1);
  }

  if (SERVICE_ROLE_KEY) {
    return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  if (ANON_KEY && ADMIN_EMAIL && ADMIN_PASSWORD) {
    const supabase = createClient(SUPABASE_URL!, ANON_KEY, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error) {
      console.error("No se pudo iniciar sesión en Supabase:", error.message);
      process.exit(1);
    }
    return supabase;
  }

  console.error(
    "Para escribir en Supabase necesitas una de estas dos opciones en .env.local:\n" +
      "  1) SUPABASE_SERVICE_ROLE_KEY=...  (Dashboard -> Settings -> API -> service_role)\n" +
      "  2) SUPABASE_ADMIN_EMAIL=... y SUPABASE_ADMIN_PASSWORD=...  (tu cuenta de /admin)\n" +
      "La anon key por sí sola no puede escribir: las políticas RLS solo permiten\n" +
      "escritura al rol 'authenticated'."
  );
  process.exit(1);
}

/** "1:03:28" / "24:16" -> "1h 3m" / "24m" */
function formatDuration(raw: string): string | undefined {
  const parts = raw.trim().split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) return undefined;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (parts.length === 3) [hours, minutes, seconds] = parts;
  else [minutes, seconds] = parts;
  if (seconds >= 30) minutes += 1;
  if (minutes >= 60) {
    hours += Math.floor(minutes / 60);
    minutes %= 60;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Scrolls to the bottom repeatedly until the card count stops growing. */
async function scrollToEnd(page: Page, cardSelector: string, label: string) {
  let previous = -1;
  let stableRounds = 0;

  for (let i = 0; i < 400; i++) {
    const count = await page.locator(cardSelector).count();
    if (count === previous) {
      if (++stableRounds >= 4) break;
    } else {
      stableRounds = 0;
      if (count % 100 === 0 && count > 0) process.stdout.write(`\r  ${label}: ${count}…`);
    }
    previous = count;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }
}

async function scrapeChannels(context: BrowserContext): Promise<ScrapedChannel[]> {
  const page = await context.newPage();
  await page.goto(PROFILE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("div.video-card.__channel", { timeout: 30_000 });

  await scrollToEnd(page, "div.video-card.__channel", "canales");

  const channels = await page.$$eval("div.video-card.__channel", (cards) =>
    cards
      .map((card) => {
        const anchor = card.querySelector('a[href*="/video/c"]');
        const href = anchor?.getAttribute("href") ?? "";
        const match = href.match(/\/video\/(c\d+)(?:[?#]|$)/);
        if (!match) return null;
        const info = Array.from(card.querySelectorAll(".video-card_info_i")).map(
          (el) => el.textContent ?? ""
        );
        const countText = info[1] ?? info[0] ?? "";
        const countMatch = countText.match(/(\d+)/);
        const resolved = new URL(href, "https://ok.ru");
        return {
          id: match[1],
          name: (card.querySelector(".video-card_n")?.textContent ?? "").trim() || match[1],
          url: `${resolved.origin}${resolved.pathname}`,
          thumbnailUrl: card.querySelector("img.video-card_img")?.getAttribute("src") ?? undefined,
          videoCount: countMatch ? Number(countMatch[1]) : undefined,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  );

  await page.close();
  return Array.from(new Map(channels.map((c) => [c.id, c])).values());
}

async function scrapeChannelVideos(
  context: BrowserContext,
  channel: ScrapedChannel
): Promise<ScrapedVideo[]> {
  const page = await context.newPage();
  try {
    await page.goto(channel.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("div.video-card[data-id]", { timeout: 15_000 });
  } catch {
    await page.close();
    return [];
  }

  // Channels with more than 20 videos lazy-load the rest on scroll.
  if ((channel.videoCount ?? 0) > 20) {
    await scrollToEnd(page, "div.video-card[data-id]", `videos de ${channel.name}`);
  }

  const videos = await page.$$eval("div.video-card[data-id]", (cards) =>
    cards
      .map((card) => {
        const id = card.getAttribute("data-id");
        if (!id) return null;
        const titleEl = card.querySelector(".video-card_n");
        return {
          id,
          title:
            (titleEl?.getAttribute("title") ?? "").trim() ||
            (titleEl?.textContent ?? "").trim() ||
            id,
          durationRaw: (card.querySelector(".video-card_duration")?.textContent ?? "").trim(),
          thumbnailUrl: card.querySelector("img.video-card_img")?.getAttribute("src") ?? undefined,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
  );

  await page.close();

  return (
    videos
      .map((v) => {
        const { streamedAt, cleanTitle } = parseStreamTitle(v.title);
        return {
          id: v.id,
          // Titles that are just a date become e.g. "13 julio 2024"; titles
          // like "H2011 del 132 al 136 2024-07-13 ..." keep the useful part.
          title: cleanTitle || formatStreamDate(streamedAt) || v.title,
          duration: v.durationRaw ? formatDuration(v.durationRaw) : undefined,
          thumbnailUrl: v.thumbnailUrl,
          streamedAt,
        };
      })
      // Chronological by stream date when known. Falls back to the video id,
      // which grows with upload order and can exceed Number.MAX_SAFE_INTEGER
      // (hence BigInt).
      .sort((a, b) => {
        if (a.streamedAt && b.streamedAt) {
          if (a.streamedAt !== b.streamedAt) return a.streamedAt < b.streamedAt ? -1 : 1;
        } else if (a.streamedAt || b.streamedAt) {
          return a.streamedAt ? -1 : 1;
        }
        return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
      })
  );
}

async function main() {
  const supabase = await createWritableClient();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: USER_AGENT,
  });
  await context.addCookies(
    COOKIE!.split("; ").map((pair) => {
      const idx = pair.indexOf("=");
      return {
        name: pair.slice(0, idx),
        value: pair.slice(idx + 1),
        domain: ".ok.ru",
        path: "/",
      };
    })
  );

  if (DRY_RUN) console.log("MODO DRY-RUN: no se escribirá nada en Supabase.\n");

  console.log("Leyendo canales de ok.ru (esto puede tardar varios minutos)…");
  const allChannels = await scrapeChannels(context);
  const channels = (ONLY_CHANNEL
    ? allChannels.filter((c) => c.id === ONLY_CHANNEL)
    : allChannels
  ).slice(0, LIMIT);
  console.log(
    `\nCanales encontrados: ${allChannels.length}` +
      (channels.length !== allChannels.length ? ` (procesando ${channels.length})` : "")
  );

  // The channel catalogue behind the "link this collection to a channel"
  // picker in /admin — the only way to repair a collection imported before the
  // channel id was stored.
  if (!DRY_RUN && allChannels.length > 0) {
    const { error } = await supabase!.from("okru_channels").upsert(
      allChannels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        url: channel.url,
        thumbnail_url: channel.thumbnailUrl ?? null,
        video_count: channel.videoCount ?? null,
        last_seen_at: new Date().toISOString(),
      }))
    );
    if (error) console.error("No se pudo guardar el catálogo de canales —", error.message);
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const [index, channel] of channels.entries()) {
    const position = `[${index + 1}/${channels.length}]`;
    const videos = await scrapeChannelVideos(context, channel);

    if (videos.length === 0) {
      console.log(`${position} ${channel.name}: sin videos, se omite`);
      skipped += 1;
      continue;
    }

    // Videos are already sorted chronologically, so the range is the ends.
    const dated = videos.filter((v) => v.streamedAt);
    const firstStreamedAt = dated[0]?.streamedAt ?? null;
    const lastStreamedAt = dated[dated.length - 1]?.streamedAt ?? null;
    const undatedCount = videos.length - dated.length;

    if (DRY_RUN) {
      const expected = channel.videoCount;
      const warn = expected && videos.length !== expected ? ` ⚠ ok.ru decía ${expected}` : "";
      const range = formatStreamRange(firstStreamedAt ?? undefined, lastStreamedAt ?? undefined);
      const undated = undatedCount ? ` · ${undatedCount} sin fecha` : "";
      console.log(
        `${position} ${channel.name}: ${videos.length} videos${warn}` +
          `${range ? ` · ${range}` : " · sin fechas"}${undated}`
      );
      continue;
    }

    const slug = slugify(`${channel.name}-${channel.id}`);

    // Every collection built out of this channel: the primary one receives the
    // new videos, and the rest (movies and such split out of it in /admin)
    // matter because the videos they hold must not be imported again.
    const { data: familyRows, error: lookupError } = await supabase!
      .from("media_items")
      .select("id, title, published, okru_channel_id, okru_channel_name, okru_channel_primary, okru_embed_url")
      .eq("okru_channel_id", channel.id);

    if (lookupError) {
      console.error(`${position} ${channel.name}: error consultando —`, lookupError.message);
      skipped += 1;
      continue;
    }

    const family = (familyRows ?? []) as (ExistingMediaItem & { okru_embed_url: string | null })[];
    let existing: ExistingMediaItem | null = family.find((row) => row.okru_channel_primary) ?? null;

    // Collections imported before the channel id was stored: adopt the one
    // still sitting on the slug this script would generate, so it gets the
    // link instead of being duplicated. Rows already tied to another channel
    // are left alone.
    if (!existing && family.length === 0) {
      const { data: bySlug } = await supabase!
        .from("media_items")
        .select("id, title, published, okru_channel_id, okru_channel_name, okru_channel_primary")
        .eq("slug", slug)
        .maybeSingle();
      const candidate = bySlug as ExistingMediaItem | null;
      if (candidate && !candidate.okru_channel_id) existing = candidate;
    }

    // Derived collections only, none primary: the admin unlinked or deleted the
    // main one. Appending to an arbitrary derived collection would scatter the
    // channel, so this needs a human decision.
    if (!existing && family.length > 0) {
      console.log(
        `${position} ${channel.name}: ${family.length} colecciones del canal pero ninguna principal, se omite`
      );
      skipped += 1;
      continue;
    }

    if (!existing) {
      const { data, error } = await supabase!
        .from("media_items")
        .insert({
          title: channel.name,
          slug,
          type: "series" as const,
          poster_url: channel.thumbnailUrl ?? videos[0]?.thumbnailUrl ?? "",
          genres: [] as string[],
          description: null,
          status: "ongoing" as const,
          published: false,
          first_streamed_at: firstStreamedAt,
          last_streamed_at: lastStreamedAt,
          okru_channel_id: channel.id,
          okru_channel_name: channel.name,
          okru_channel_url: channel.url,
          okru_channel_primary: true,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error(`${position} ${channel.name}: error creando —`, error?.message);
        skipped += 1;
        continue;
      }

      const { error: episodesError } = await supabase!.from("episodes").insert(
        videos.map((video, i) => ({
          media_item_id: data.id as string,
          episode_number: i + 1,
          season_number: null,
          title: video.title,
          okru_embed_url: `https://ok.ru/videoembed/${video.id}`,
          duration: video.duration ?? null,
          thumbnail_url: video.thumbnailUrl ?? null,
          streamed_at: video.streamedAt ?? null,
        }))
      );

      if (episodesError) {
        console.error(
          `${position} ${channel.name}: error guardando episodios —`,
          episodesError.message
        );
        continue;
      }

      created += 1;
      const expected = channel.videoCount;
      const warn = expected && videos.length !== expected ? ` (ok.ru decía ${expected})` : "";
      const range = formatStreamRange(firstStreamedAt ?? undefined, lastStreamedAt ?? undefined);
      console.log(
        `${position} ${channel.name}: nuevo · ${videos.length} episodios${warn}` +
          `${range ? ` · ${range}` : ""}`
      );
      continue;
    }

    // From here on the collection already exists and may have been edited by
    // hand, so nothing it owns gets overwritten — only the missing videos are
    // appended.
    const mediaItemId = existing.id;
    const label =
      existing.title === channel.name ? channel.name : `${existing.title} (${channel.name})`;

    // Episodes of every collection of this channel, not just the primary one:
    // a video moved into a collection of its own is still imported, and must
    // not come back here.
    const familyIds = family.length > 0 ? family.map((row) => row.id) : [mediaItemId];
    const { data: familyEpisodeRows, error: episodesLookupError } = await supabase!
      .from("episodes")
      .select("media_item_id, episode_number, season_number, okru_embed_url, streamed_at")
      .in("media_item_id", familyIds);

    if (episodesLookupError) {
      console.error(`${position} ${label}: error leyendo episodios —`, episodesLookupError.message);
      skipped += 1;
      continue;
    }

    const familyEpisodes = (familyEpisodeRows ?? []) as (ExistingEpisode & {
      media_item_id: string;
    })[];
    const existingEpisodes = familyEpisodes.filter(
      (episode) => episode.media_item_id === mediaItemId
    );

    const knownVideoIds = new Set(
      [
        // Movies and other single-video collections keep their video on the
        // item itself, with no episode row to find it by.
        ...family.map((row) => row.okru_embed_url),
        ...familyEpisodes.map((episode) => episode.okru_embed_url),
      ]
        .map((url) => (url ? videoIdFromEmbedUrl(url) : null))
        .filter((id): id is string => Boolean(id))
    );
    const newVideos = videos.filter((video) => !knownVideoIds.has(video.id));

    // Only what this collection ends up holding: dates already stored (typed by
    // the admin, in some cases) plus the videos about to be appended. Videos
    // that now live in a collection of their own are somebody else's range.
    const [rangeStart, rangeEnd] = streamRangeOf([
      ...existingEpisodes.map((episode) => episode.streamed_at),
      ...newVideos.map((video) => video.streamedAt),
    ]);

    const refresh: Record<string, unknown> = {
      okru_channel_id: channel.id,
      okru_channel_name: channel.name,
      okru_channel_url: channel.url,
      okru_channel_primary: true,
      first_streamed_at: rangeStart,
      last_streamed_at: rangeEnd,
    };

    // The title only follows ok.ru while it still matches the channel name —
    // i.e. while the admin hasn't renamed the collection. The slug never
    // changes: public links point at it.
    if (existing.okru_channel_name && existing.title === existing.okru_channel_name) {
      refresh.title = channel.name;
    }

    const { error: updateError } = await supabase!
      .from("media_items")
      .update(refresh)
      .eq("id", mediaItemId);

    if (updateError) {
      console.error(`${position} ${label}: error actualizando —`, updateError.message);
      skipped += 1;
      continue;
    }

    if (newVideos.length === 0) {
      unchanged += 1;
      const split = family.length > 1 ? ` · ${family.length} colecciones del canal` : "";
      console.log(
        `${position} ${label}: sin videos nuevos (${existingEpisodes.length} episodios)${split}`
      );
      continue;
    }

    const slot = nextEpisodeSlot(existingEpisodes);
    const { error: insertError } = await supabase!.from("episodes").insert(
      newVideos.map((video, i) => ({
        media_item_id: mediaItemId,
        episode_number: slot.episodeNumber + i,
        season_number: slot.seasonNumber,
        title: video.title,
        okru_embed_url: `https://ok.ru/videoembed/${video.id}`,
        duration: video.duration ?? null,
        thumbnail_url: video.thumbnailUrl ?? null,
        streamed_at: video.streamedAt ?? null,
      }))
    );

    if (insertError) {
      console.error(`${position} ${label}: error añadiendo episodios —`, insertError.message);
      skipped += 1;
      continue;
    }

    updated += 1;
    const draftNote = existing.published ? "" : " · sigue en borrador";
    console.log(
      `${position} ${label}: +${newVideos.length} episodio${newVideos.length === 1 ? "" : "s"}` +
        ` (total ${existingEpisodes.length + newVideos.length})${draftNote}`
    );
  }

  await browser.close();

  if (DRY_RUN) {
    console.log("\nDry-run terminado. No se escribió nada en Supabase.");
  } else {
    console.log(
      `\nListo. Creados: ${created} · Con videos nuevos: ${updated} · Sin cambios: ${unchanged}` +
        ` · Omitidos: ${skipped}` +
        `\nLos nuevos quedan como BORRADOR en /admin — publícalos cuando termines de completarlos.` +
        `\nLos que ya existían conservan su título, póster y estado: solo se les añadieron los videos nuevos.`
    );
  }
}

main().catch((error) => {
  console.error("El script falló:", error);
  process.exit(1);
});
