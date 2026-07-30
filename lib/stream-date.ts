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

/** The raw ok.ru form: "2026-07-28 00-19-09". */
const ISO_DATE_PATTERN = /(\d{4})-(\d{2})-(\d{2})(?:[ _T]+(\d{2})[-:](\d{2})[-:](\d{2}))?/;

/**
 * The human form this module itself produces: "30 abril 2026". Parsing it back
 * matters because `formatStreamDate` rewrites episode titles, so without this
 * a title that already went through the importer would become unreadable to
 * the "detect dates" backfill.
 */
const SPANISH_DATE_PATTERN = new RegExp(
  `\\b(\\d{1,2})\\s+(${MONTHS_ES.join("|")})\\s+(\\d{4})\\b`,
  "i"
);

export interface ParsedStreamTitle {
  /** "YYYY-MM-DDTHH:MM:SS" (or "YYYY-MM-DDT00:00:00" when the title had no time). */
  streamedAt?: string;
  /** The title with the date removed; empty when the title was only a date. */
  cleanTitle: string;
}

function build(
  rawTitle: string,
  pattern: RegExp,
  year: string,
  month: string,
  day: string,
  time: string
): ParsedStreamTitle {
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return { cleanTitle: rawTitle.trim() };
  }

  const pad = (value: string) => value.padStart(2, "0");
  return {
    streamedAt: `${year}-${pad(month)}-${pad(day)}T${time}`,
    cleanTitle: rawTitle.replace(pattern, "").replace(/\s+/g, " ").trim(),
  };
}

export function parseStreamTitle(rawTitle: string): ParsedStreamTitle {
  const iso = rawTitle.match(ISO_DATE_PATTERN);
  if (iso) {
    const [, year, month, day, hour, minute, second] = iso;
    return build(
      rawTitle,
      ISO_DATE_PATTERN,
      year,
      month,
      day,
      hour ? `${hour}:${minute}:${second}` : "00:00:00"
    );
  }

  const spanish = rawTitle.match(SPANISH_DATE_PATTERN);
  if (spanish) {
    const [, day, monthName, year] = spanish;
    const monthIndex = MONTHS_ES.indexOf(monthName.toLowerCase());
    if (monthIndex !== -1) {
      // No clock time survives this format; the day is what matters.
      return build(rawTitle, SPANISH_DATE_PATTERN, year, String(monthIndex + 1), day, "00:00:00");
    }
  }

  return { cleanTitle: rawTitle.trim() };
}

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
