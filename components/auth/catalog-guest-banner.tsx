import { GuestSyncBanner } from "@/components/auth/guest-sync-banner";
import { getAccount } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Phones, signed out: the sign-up nudge above the catalog grid — the compact
 * stand-in for ContinueWatching's GuestPrompt, which wider screens show.
 */
export async function CatalogGuestBanner() {
  if (!isSupabaseConfigured) return null;
  const account = await getAccount();
  if (account) return null;

  return <GuestSyncBanner className="mt-3 md:hidden" />;
}
