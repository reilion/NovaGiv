import "server-only";

/**
 * Whether the channel is live right now, from Twitch's Helix API.
 *
 * Uses an app access token (client-credentials flow): no viewer signs in to
 * anything, and the token can only read public data like this. Credentials
 * come from an application registered at https://dev.twitch.tv/console/apps.
 *
 * The answer is cached for LIVE_REVALIDATE_SECONDS through Next's data cache,
 * so every page render shares one Twitch request per minute instead of making
 * its own.
 */

const LIVE_REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 3_000;

export interface TwitchLiveStatus {
  isLive: boolean;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
}

const OFFLINE: TwitchLiveStatus = { isLive: false };

export const isTwitchConfigured = Boolean(
  process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
);

/**
 * The app token, kept for the life of the server instance. Twitch issues them
 * for about two months; asking for a new one per request would be wasteful and
 * Twitch discourages it.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function appAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`token: Twitch respondió ${response.status}`);

  const data = (await response.json()) as { access_token: string; expires_in: number };
  // A minute early, so a token never expires between this check and its use.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

interface HelixStream {
  type: string;
  title: string;
  game_name: string;
  viewer_count: number;
  started_at: string;
}

async function fetchStream(login: string, token: string): Promise<Response> {
  return fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: {
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: LIVE_REVALIDATE_SECONDS, tags: ["twitch-live"] },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** `novagiv` out of `https://twitch.tv/novagiv`, `twitch.tv/novagiv/`, or `novagiv`. */
export function twitchLoginFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([A-Za-z0-9_]{3,25})/i);
  if (match) return match[1].toLowerCase();
  return /^[A-Za-z0-9_]{3,25}$/.test(url) ? url.toLowerCase() : null;
}

/**
 * Live status of `login`. Any failure — not configured, Twitch down or slow —
 * reads as offline: saying "en vivo" about a stream that is not happening is
 * worse than missing a minute of one that is.
 */
export async function getTwitchLiveStatus(login: string | null): Promise<TwitchLiveStatus> {
  if (!isTwitchConfigured || !login) return OFFLINE;

  try {
    let response = await fetchStream(login, await appAccessToken());

    // Revoked or expired early: drop the token and try once with a fresh one.
    if (response.status === 401) {
      cachedToken = null;
      response = await fetchStream(login, await appAccessToken());
    }

    if (!response.ok) throw new Error(`streams: Twitch respondió ${response.status}`);

    const { data } = (await response.json()) as { data: HelixStream[] };
    const stream = data[0];
    if (!stream || stream.type !== "live") return OFFLINE;

    return {
      isLive: true,
      title: stream.title || undefined,
      gameName: stream.game_name || undefined,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
    };
  } catch (error) {
    console.error("Twitch — no se pudo consultar el directo:", error);
    return OFFLINE;
  }
}
