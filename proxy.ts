import type { NextRequest } from "next/server";

import {
  LAST_VISIT_COOKIE,
  LAST_VISIT_MAX_AGE,
  nextVisitState,
  parseVisitCookie,
  serializeVisitCookie,
} from "@/lib/last-visit";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Before updateSession on purpose: it builds its response from the request,
  // and only what is already on the request by then reaches the page. That is
  // what lets the very request that opens a new visit render against the new
  // baseline instead of the previous one.
  const visit = nextVisitState(
    parseVisitCookie(request.cookies.get(LAST_VISIT_COOKIE)?.value),
    Date.now()
  );
  if (visit) request.cookies.set(LAST_VISIT_COOKIE, serializeVisitCookie(visit));

  const response = await updateSession(request);

  if (visit) {
    response.cookies.set(LAST_VISIT_COOKIE, serializeVisitCookie(visit), {
      path: "/",
      maxAge: LAST_VISIT_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
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
