import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { sendEmail } from "@/lib/email/resend";
import {
  codeEmail,
  confirmSignupEmail,
  emailChangeEmail,
  linkEmail,
  noticeEmail,
  recoveryEmail,
  type RenderedEmail,
} from "@/lib/email/templates";
import { getPublicSiteUrl } from "@/lib/site-url";

/**
 * Supabase Auth's "Send Email" hook. With the hook on, Supabase sends no email
 * of its own: every auth email (sign-up confirmation, password reset, email
 * change…) arrives here as a signed POST, and this renders our template and
 * hands it to Resend. Configured by scripts/configure-auth-email.mjs.
 *
 * Kept out of proxy.ts's matcher: the bot guard there would judge Supabase's
 * HTTP client as a scraper.
 */

export const runtime = "nodejs";

interface HookPayload {
  user: {
    email: string;
    new_email?: string;
    user_metadata?: { username?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
  };
}

/** Five minutes either way, as the Standard Webhooks spec recommends. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Standard Webhooks signature check (what Supabase signs hooks with). The
 * secret is `v1,whsec_<base64>`; the signature header is a space-separated list
 * of `v1,<base64 hmac>`, any one of which may match.
 */
function verifySignature(request: NextRequest, body: string, secret: string): boolean {
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signatures = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/**
 * The link the email carries: back through app/auth/confirm with the token, to
 * wherever the app asked (`redirect_to` already points at /auth/confirm, with a
 * `next` when it matters). Only our own origins are trusted for that; anything
 * else falls back to the canonical one.
 */
function confirmUrl(redirectTo: string, tokenHash: string, type: string): string {
  const site = getPublicSiteUrl();
  let target: URL;

  try {
    target = new URL(redirectTo);
    const trusted =
      target.origin === new URL(site).origin || target.hostname === "localhost";
    if (!trusted || target.pathname !== "/auth/confirm") throw new Error("untrusted");
  } catch {
    target = new URL("/auth/confirm", site);
  }

  target.searchParams.set("token_hash", tokenHash);
  target.searchParams.set("type", type);
  return target.toString();
}

function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("email-hook — SEND_EMAIL_HOOK_SECRET no está configurada.");
    return hookError(500, "Email hook is not configured.");
  }

  const body = await request.text();
  if (!verifySignature(request, body, secret)) {
    return hookError(401, "Invalid signature.");
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return hookError(400, "Invalid payload.");
  }

  const { user, email_data: data } = payload;
  const username = user.user_metadata?.username ?? null;
  const siteUrl = getPublicSiteUrl();
  const action = data.email_action_type;

  const outgoing: { to: string; email: RenderedEmail }[] = [];

  switch (action) {
    case "signup":
      outgoing.push({
        to: user.email,
        email: confirmSignupEmail({
          username,
          url: confirmUrl(data.redirect_to, data.token_hash, "signup"),
          siteUrl,
        }),
      });
      break;

    case "recovery":
      outgoing.push({
        to: user.email,
        email: recoveryEmail({
          username,
          url: confirmUrl(data.redirect_to, data.token_hash, "recovery"),
          siteUrl,
        }),
      });
      break;

    case "email_change": {
      const newEmail = user.new_email ?? user.email;
      // Secure email change (on in this project) sends two: the current address
      // gets token_hash_new, the new address gets token_hash — Supabase's naming,
      // backwards as it reads. With it off only token_hash exists, for the new one.
      if (data.token_hash_new) {
        outgoing.push({
          to: user.email,
          email: emailChangeEmail({
            username,
            newEmail,
            toCurrentAddress: true,
            url: confirmUrl(data.redirect_to, data.token_hash_new, "email_change"),
            siteUrl,
          }),
        });
      }
      outgoing.push({
        to: newEmail,
        email: emailChangeEmail({
          username,
          newEmail,
          toCurrentAddress: false,
          url: confirmUrl(data.redirect_to, data.token_hash, "email_change"),
          siteUrl,
        }),
      });
      break;
    }

    case "magiclink":
    case "invite":
      outgoing.push({
        to: user.email,
        email: linkEmail({
          kind: action,
          url: confirmUrl(data.redirect_to, data.token_hash, action),
          siteUrl,
        }),
      });
      break;

    case "reauthentication":
      outgoing.push({ to: user.email, email: codeEmail({ code: data.token, siteUrl }) });
      break;

    default:
      outgoing.push({ to: user.email, email: noticeEmail({ action, siteUrl }) });
  }

  try {
    await Promise.all(outgoing.map(({ to, email }) => sendEmail({ to, ...email })));
  } catch (error) {
    console.error(`email-hook — no se pudo enviar "${action}":`, error);
    // Supabase shows this to the caller as a failed sign-up / reset, which is
    // the honest outcome: the email the person is waiting for never left.
    return hookError(502, "Could not send the email.");
  }

  return NextResponse.json({});
}
