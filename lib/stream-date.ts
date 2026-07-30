/**
 * ok.ru video titles carry the date the stream happened, either as the whole
 * title ("2026-07-28 00-19-09") or embedded in a longer one
 * ("H2011 del 132 al 136 2024-07-13 00-39-47"). Parsing it lets the catalog
 * sort and filter collections by when they were streamed.
 *
 * Dates are handled as plain wall-clock strings, never as UTC instants: a
 * stream at 00:19 must not slide to the previous day when rendered in a
 * negative-offset timezone.
 */

const STREAM_DATE_PATTERN =
  /(\d{4})-(\d{2})-(\d{2})(?:[ _T]+(\d{2})[-:](\d{2})[-:](\d{2}))?/;

export interface ParsedStreamTitle {
  /** "YYYY-MM-DDTHH:MM:SS" (or "YYYY-MM-DDT00:00:00" when the title had no time). */
  streamedAt?: string;
  /** The title with the date removed; empty when the title was only a date. */
  cleanTitle: string;
}

export function parseStreamTitle(rawTitle: string): ParsedStreamTitle {
  const match = rawTitle.match(STREAM_DATE_PATTERN);
  if (!match) return { cleanTitle: rawTitle.trim() };

  const [, year, month, day, hour, minute, second] = match;
  const time = hour ? `${hour}:${minute}:${second}` : "00:00:00";

  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return { cleanTitle: rawTitle.trim() };
  }

  return {
    streamedAt: `${year}-${month}-${day}T${time}`,
    cleanTitle: rawTitle.replace(STREAM_DATE_PATTERN, "").replace(/\s+/g, " ").trim(),
  };
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Formats without going through Date, so no timezone shifting can occur. */
export function formatStreamDate(value: string | undefined, opts?: { withYear?: boolean }): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = MONTHS_ES[Number(month) - 1] ?? month;
  const base = `${Number(day)} ${monthName}`;
  return opts?.withYear === false ? base : `${base} ${year}`;
}

/** "12 marzo 2024 – 8 abril 2024", collapsing to one date when they match. */
export function formatStreamRange(from?: string, to?: string): string {
  if (!from && !to) return "";
  if (!from || !to) return formatStreamDate(from ?? to);

  const sameDay = from.slice(0, 10) === to.slice(0, 10);
  if (sameDay) return formatStreamDate(from);

  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatStreamDate(from, { withYear: !sameYear })} – ${formatStreamDate(to)}`;
}

export function streamYear(value: string | undefined): number | undefined {
  const year = value?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? Number(year) : undefined;
}
