import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/url";

// The link Supabase mails out comes back here in one of two shapes depending on
// the project's flow: a one-time token to verify, or a PKCE code to exchange.
const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Landing route for every link Supabase sends by email — confirming a sign-up,
 * confirming a new address. It turns the token in the URL into a session (or,
 * for an email change, applies the change) and then drops the visitor on the
 * page the link asked for, with the token stripped from the address bar.
 */
export async function GET(request: NextRequest) {
  // Nobody can be holding a link this project sent, so whatever is in the URL
  // is somebody else's or a leftover: send them to the catalog.
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/", request.url));

  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next")) ?? "/";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  // Expired, already used, or opened in a browser that never asked for it.
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
