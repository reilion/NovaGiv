const OKRU_WATCH_URL = /ok\.ru\/video\/(\d+)/i;

/**
 * ok.ru's normal watch-page URL (ok.ru/video/{id}) sends
 * `X-Frame-Options: sameorigin` and refuses to load inside an <iframe>.
 * Only the dedicated embed URL (ok.ru/videoembed/{id}) allows embedding, so
 * any watch-page link pasted by mistake is rewritten automatically.
 */
export function toOkRuEmbedUrl(url: string): string {
  const match = url.match(OKRU_WATCH_URL);
  if (!match) return url;
  return `https://ok.ru/videoembed/${match[1]}`;
}

/**
 * The same embed, told to start playing on its own.
 *
 * Used when the viewer moves to another episode: they have just clicked, so the
 * browser's autoplay policy is satisfied and stopping to press play again on
 * every episode would be busywork. Never on the first render of a collection —
 * a page that starts making noise by itself is the other kind of rude.
 */
export function withAutoplay(embedUrl: string): string {
  const separator = embedUrl.includes("?") ? "&" : "?";
  return `${embedUrl}${separator}autoplay=1`;
}
