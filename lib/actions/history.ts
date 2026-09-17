"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Drops one collection from the account's history — "quitar de Seguir viendo".
 *
 * No user filter: the delete policy on `watch_history` already limits a session
 * to its own rows (see supabase/schema.sql), so an id belonging to somebody
 * else matches nothing.
 */
export async function removeFromHistory(mediaItemId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "El catálogo todavía no está conectado." };

  const supabase = await createClient();
  const { error } = await supabase.from("watch_history").delete().eq("media_item_id", mediaItemId);

  if (error) {
    console.error("removeFromHistory error —", error.message);
    return { error: "No pudimos quitarlo del historial." };
  }

  // Both places it shows: the list itself and the shelf on the catalog.
  revalidatePath("/historial");
  revalidatePath("/");

  return {};
}
