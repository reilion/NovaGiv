import "server-only";

import {
  forgetRateLimit,
  rateLimit,
  type RateLimitRule,
  type RateLimitVerdict,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The same fixed-window limit as lib/rate-limit.ts, but counted in Postgres
 * (`rate_limit_hit` in supabase/schema.sql) so every server instance shares one
 * tally. In memory alone, each Vercel instance kept its own count and lost it
 * on every cold start, which multiplied the budget by however many instances a
 * flood happened to land on.
 *
 * For the server actions that guard something worth the round trip — sign-in,
 * sign-up, password reset, view counting. The proxy's per-page budget stays in
 * memory (lib/bot-guard.ts): a database call on every page request would cost
 * more than it saves; the Vercel Firewall is the shared tool for that layer.
 *
 * Fails open to the in-memory counter: if the table is missing (schema.sql not
 * re-run yet) or Supabase is slow, sign-in keeps working with the old,
 * per-instance protection instead of locking everybody out.
 */
export async function sharedRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitVerdict> {
  if (!isSupabaseConfigured) return rateLimit(key, rule);

  try {
    const { data, error } = await createAdminClient()
      .rpc("rate_limit_hit", {
        p_key: key,
        p_limit: rule.limit,
        p_window_seconds: Math.ceil(rule.windowMs / 1000),
      })
      .abortSignal(AbortSignal.timeout(2_000))
      .single<{ allowed: boolean; remaining: number; retry_after_seconds: number }>();

    if (error || !data) throw new Error(error?.message ?? "sin respuesta");

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      retryAfterSeconds: data.retry_after_seconds,
    };
  } catch (error) {
    console.error(
      "sharedRateLimit — usando el contador en memoria:",
      error instanceof Error ? error.message : error
    );
    return rateLimit(key, rule);
  }
}

/** Forgets a key everywhere — after a sign-in that worked. */
export async function forgetSharedRateLimit(key: string): Promise<void> {
  forgetRateLimit(key);
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await createAdminClient()
      .rpc("rate_limit_forget", { p_key: key })
      .abortSignal(AbortSignal.timeout(2_000));
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(
      "forgetSharedRateLimit —",
      error instanceof Error ? error.message : error
    );
  }
}
