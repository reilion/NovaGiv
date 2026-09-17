import "server-only";

import { notFound } from "next/navigation";

import { findEpisodeByParam } from "@/lib/episode-param";
import { getLikedVideoIds, getMediaBySlug } from "@/lib/queries";
import type { MediaItem } from "@/types/media";

export interface MediaView {
  item: MediaItem;
  likedVideoIds: string[] | null;
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

  return {
    item,
    likedVideoIds: await getLikedVideoIds(item.id),
    initialEpisodeId: findEpisodeByParam(item.episodes ?? [], episodeParam)?.id,
  };
}
