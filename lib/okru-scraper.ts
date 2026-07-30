import "server-only";

import * as cheerio from "cheerio";

/**
 * Scrapes the streamer's own public ok.ru profile (channels + the videos in
 * each channel) so the admin can turn them into draft collections instead of
 * re-typing every title/episode by hand. Selectors were reverse-engineered
 * against the real markup on 2026-07-29 — ok.ru has no public API for this,
 * and may change its HTML at any time, breaking these selectors.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface OkRuChannel {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  videoCount?: number;
}

export interface OkRuVideo {
  id: string;
  title: string;
  duration?: string;
  thumbnailUrl?: string;
  embedUrl: string;
}

function assertOkRuUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida.");
  }
  if (parsed.hostname !== "ok.ru") {
    throw new Error("Solo se admiten URLs de ok.ru.");
  }
  return parsed;
}

async function fetchOkRuHtml(rawUrl: string): Promise<string> {
  const url = assertOkRuUrl(rawUrl);

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ok.ru respondió con estado ${response.status}.`);
  }

  return response.text();
}

/** "1:03:28" / "24:16" -> "1h 3m" / "24m", matching the rest of the app's duration format. */
function formatOkRuDuration(raw: string): string | undefined {
  const parts = raw.trim().split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => Number.isNaN(part))) {
    return undefined;
  }

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

export function toOkRuVideoEmbedUrl(videoId: string): string {
  return `https://ok.ru/videoembed/${videoId}`;
}

/** Channels shown on a profile's "video/channels" page. */
export async function fetchOkRuChannels(channelsUrl: string): Promise<OkRuChannel[]> {
  const html = await fetchOkRuHtml(channelsUrl);
  const $ = cheerio.load(html);
  const channels: OkRuChannel[] = [];

  $("div.video-card.__channel").each((_, el) => {
    const $card = $(el);
    const link = $card.find('a[href*="/video/c"]').first();
    const href = link.attr("href");
    const match = href?.match(/\/video\/(c\d+)$/);
    if (!match) return;

    const id = match[1];
    const name = $card.find(".video-card_n").first().text().trim() || link.attr("aria-label") || id;
    const thumbnailUrl = $card.find("img.video-card_img").first().attr("src");

    const infoTexts = $card
      .find(".video-card_info_i")
      .map((__, span) => $(span).text())
      .get();
    const videoCountText = infoTexts[1] ?? infoTexts[0];
    const videoCountMatch = videoCountText?.match(/(\d+)/);

    channels.push({
      id,
      name,
      url: new URL(href!, "https://ok.ru").toString(),
      thumbnailUrl,
      videoCount: videoCountMatch ? Number(videoCountMatch[1]) : undefined,
    });
  });

  return channels;
}

/** Videos inside a single channel, oldest first (so episode 1 = the earliest recording). */
export async function fetchOkRuChannelVideos(channelUrl: string): Promise<OkRuVideo[]> {
  const html = await fetchOkRuHtml(channelUrl);
  const $ = cheerio.load(html);
  const videos: OkRuVideo[] = [];

  $("div.video-card[data-id]").each((_, el) => {
    const $card = $(el);
    const id = $card.attr("data-id");
    if (!id) return;

    const titleEl = $card.find(".video-card_n").first();
    const title = titleEl.attr("title")?.trim() || titleEl.text().trim() || id;
    const durationRaw = $card.find(".video-card_duration").first().text().trim();
    const thumbnailUrl = $card.find("img.video-card_img").first().attr("src");

    videos.push({
      id,
      title,
      duration: durationRaw ? formatOkRuDuration(durationRaw) : undefined,
      thumbnailUrl,
      embedUrl: toOkRuVideoEmbedUrl(id),
    });
  });

  // ok.ru lists newest first; video IDs are assigned in upload order and can
  // exceed Number.MAX_SAFE_INTEGER, so compare as BigInt rather than Number.
  return videos.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}
