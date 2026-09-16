import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { loginPath, safeRedirectPath } from "@/lib/url";

/** Routes that only make sense while signed out. */
const AUTH_ROUTES = new Set(["/login", "/register"]);

/** Supabase writes its session under `sb-<project>-auth-token`. */
function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
}

/**
 * Refreshes the Supabase session cookie on every request, gates /admin behind
 * the admin role and /account behind any session, and keeps signed-in visitors
 * out of the auth forms. Called
 * from the root proxy.ts, whose matcher covers the whole site: a session that
 * is only ever refreshed under /admin would quietly expire on a visitor who
 * just browses the catalog.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAccountRoute = pathname.startsWith("/account");
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  // The catalog is public and most of its traffic is signed out. Without a
  // session cookie there is nothing to refresh and nothing to gate, so skip the
  // round trip to the auth server entirely.
  if (!isAdminRoute && !isAccountRoute && !hasSessionCookie(request)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add logic between createServerClient and getUser(): it refreshes
  // the token, and skipping it can randomly log users out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Legacy entry point: the admin now signs in through the same form as
  // everyone else, so old bookmarks are forwarded instead of 404ing.
  if (pathname === "/admin/login") {
    return NextResponse.redirect(new URL(user ? "/admin" : loginPath("/admin"), request.url));
  }

  if (isAdminRoute) {
    if (!user) {
      return NextResponse.redirect(new URL(loginPath(pathname), request.url));
    }

    // Signing up is open to anyone now, so a session is no longer proof of
    // anything: /admin needs the role. RLS says the same (see is_admin() in
    // supabase/schema.sql) — this only saves the panel from rendering empty.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAccountRoute && !user) {
    return NextResponse.redirect(new URL(loginPath(pathname), request.url));
  }

  // Only on GET: the login and sign-up forms POST to these same URLs, and
  // redirecting that would swallow the server action.
  if (isAuthRoute && user && request.method === "GET") {
    const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next ?? "/", request.url));
  }

  return supabaseResponse;
}
