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
