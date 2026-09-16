import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything but static assets: /admin needs the gate, and every other page
  // needs the session cookie refreshed so a logged-in visitor browsing the
  // catalog is not silently signed out. updateSession bails out early when the
  // request carries no session cookie at all.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
