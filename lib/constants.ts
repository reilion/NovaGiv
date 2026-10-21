import { MEDIA_TYPE_LABELS, type MediaType, type SortOption } from "@/types/media";

/**
 * Temporary: types without content yet. They are left out of the catalog's
 * filter tabs and of the type pickers in /admin (a collection that already has
 * one keeps showing it). Remove a type from here once it has collections; that
 * is the whole switch.
 */
export const HIDDEN_MEDIA_TYPES: readonly MediaType[] = ["special", "karaoke"];

/** Types offered in the /admin pickers, in label order. */
export const SELECTABLE_MEDIA_TYPES = (Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).filter(
  (type) => !HIDDEN_MEDIA_TYPES.includes(type)
);

const ALL_FILTER_TABS: { value: MediaType | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "movie", label: "Películas" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
  { value: "special", label: "Especiales / Votaciones" },
  { value: "karaoke", label: "Karaokes" },
];

export const FILTER_TABS = ALL_FILTER_TABS.filter(
  (tab) => tab.value === "all" || !HIDDEN_MEDIA_TYPES.includes(tab.value)
);

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "streamed", label: "Stream más reciente" },
  { value: "streamed-asc", label: "Stream más antiguo" },
  { value: "az", label: "A-Z" },
  { value: "year", label: "Año" },
];

export const MONTHS: { value: string; label: string }[] = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

/**
 * Temporary: while this is true, the view counters are drawn for admins only —
 * on the cards, in the player, in its episode list and in the preview image a
 * shared link produces. Likes are unaffected.
 *
 * Flip it to false to give them back to everybody; that is the whole switch,
 * there is nothing else to undo. The numbers keep being counted either way, so
 * nothing is lost in the meantime.
 */
export const VIEW_COUNTS_ADMIN_ONLY = true;

/**
 * How many ok.ru channels /admin/import syncs in one run. ok.ru serves the
 * profile's channel grid 20 at a time and only a real browser can ask for the
 * rest, so the panel sticks to the most recent ones — which is where new
 * streams show up anyway. `pnpm okru:sync` is still the tool for the whole
 * catalogue.
 */
export const OKRU_SYNC_CHANNEL_LIMIT = 15;
