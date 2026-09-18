/**
 * Whether there is a Supabase project behind this deployment at all.
 *
 * Its own module, and deliberately without `server-only`: the proxy asks in the
 * edge runtime, the server actions ask in Node, and the answer should not cost
 * either of them an import of the whole catalog layer. `NEXT_PUBLIC_*` is
 * inlined at build time, so it is the same answer everywhere.
 *
 * Without a project the site still runs, on the demo catalog in
 * lib/mock-data.ts — that is what makes the first `pnpm dev` worth anything.
 * Everything that needs a real backend checks this first and says so, rather
 * than building a client on two undefined values and throwing wherever it
 * happens to be used.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * What every account feature answers with while that is false. One string, so
 * the sign-in form, the sign-up form and /account cannot each invent their own
 * explanation of the same situation.
 */
export const NO_SUPABASE_ERROR =
  "Las cuentas necesitan una base de datos y este sitio está corriendo con datos de ejemplo. Configura Supabase (ver el README) para poder registrarte.";
