/**
 * Imports every ok.ru channel (and all of its videos) from the streamer's
 * profile into Supabase as unpublished drafts, ready to be renamed/completed
 * and published from /admin.
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

  let created = 0;
  let updated = 0;
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

    const { data: existing, error: lookupError } = await supabase!
      .from("media_items")
      .select("id, published")
      .eq("slug", slug)
      .maybeSingle();

    if (lookupError) {
      console.error(`${position} ${channel.name}: error consultando —`, lookupError.message);
      skipped += 1;
      continue;
    }

    // Never silently un-publish something the admin already finished.
    if (existing?.published) {
      console.log(`${position} ${channel.name}: ya publicado, se respeta`);
      skipped += 1;
      continue;
    }

    const row = {
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
    };

    let mediaItemId: string;
    if (existing) {
      mediaItemId = existing.id as string;
      const { error } = await supabase!.from("media_items").update(row).eq("id", mediaItemId);
      if (error) {
        console.error(`${position} ${channel.name}: error actualizando —`, error.message);
        skipped += 1;
        continue;
      }
      await supabase!.from("episodes").delete().eq("media_item_id", mediaItemId);
      updated += 1;
    } else {
      const { data, error } = await supabase!
        .from("media_items")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) {
        console.error(`${position} ${channel.name}: error creando —`, error?.message);
        skipped += 1;
        continue;
      }
      mediaItemId = data.id as string;
      created += 1;
    }

    const { error: episodesError } = await supabase!.from("episodes").insert(
      videos.map((video, i) => ({
        media_item_id: mediaItemId,
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
      console.error(`${position} ${channel.name}: error guardando episodios —`, episodesError.message);
    } else {
      const expected = channel.videoCount;
      const warn = expected && videos.length !== expected ? ` (ok.ru decía ${expected})` : "";
      const range = formatStreamRange(firstStreamedAt ?? undefined, lastStreamedAt ?? undefined);
      console.log(
        `${position} ${channel.name}: ${videos.length} episodios${warn}` +
          `${range ? ` · ${range}` : ""}`
      );
    }
  }

  await browser.close();

  if (DRY_RUN) {
    console.log("\nDry-run terminado. No se escribió nada en Supabase.");
  } else {
    console.log(
      `\nListo. Creados: ${created} · Actualizados: ${updated} · Omitidos: ${skipped}` +
        `\nTodos quedan como BORRADOR en /admin — publícalos cuando termines de completarlos.`
    );
  }
}

main().catch((error) => {
  console.error("El script falló:", error);
  process.exit(1);
});
