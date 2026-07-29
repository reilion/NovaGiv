const ACCENTED_CHARS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
  Á: "A",
  É: "E",
  Í: "I",
  Ó: "O",
  Ú: "U",
  Ü: "U",
  Ñ: "N",
};

/** Strips Spanish accents/diacritics, preserving case — e.g. "Código" -> "Codigo". */
export function stripAccents(value: string): string {
  return value
    .split("")
    .map((char) => ACCENTED_CHARS[char] ?? char)
    .join("");
}

/** Case- and accent-insensitive form for matching, e.g. so "codigo" matches "Código". */
export function normalizeSearch(value: string): string {
  return stripAccents(value).toLowerCase();
}

/** URL-safe slug: lowercase, accent-stripped, non-alphanumerics collapsed to hyphens. */
export function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
