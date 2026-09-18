import "server-only";

import { notFound } from "next/navigation";

import { findEpisodeByParam } from "@/lib/episode-param";
import { getMediaBySlug, getViewerVideoIds } from "@/lib/queries";
import type { MediaItem } from "@/types/media";

export interface MediaView {
  item: MediaItem;
  likedVideoIds: string[] | null;
  /** Videos on the viewer's "Ver después" list; null, like the likes, without a session. */
  savedVideoIds: string[] | null;
  /** Resolved from `?ep=`; undefined plays the collection from its first episode. */
  initialEpisodeId?: string;
}

/**
 * Everything one view of a title needs, shared by app/v/[slug] and by the route
 * that intercepts it as a dialog — the two have to load identically, or opening
 * a title from the catalog and opening its link cold would differ.
 */
export async function loadMediaView(slug: string, episodeParam?: string): Promise<MediaView> {
  const item = await getMediaBySlug(slug);

  // A slug that no longer resolves is a title that was unpublished or deleted,
  // which is exactly a 404 — links to it have been shared.
  if (!item) notFound();

  const viewer = await getViewerVideoIds(item);

  return {
    item,
    likedVideoIds: viewer?.liked ?? null,
    savedVideoIds: viewer?.saved ?? null,
    initialEpisodeId: findEpisodeByParam(item.episodes ?? [], episodeParam)?.id,
  };
}
