/**
 * Who a request came from, as far as the headers in front of us can say.
 *
 * Takes a `Headers` rather than reading `next/headers` itself, because the
 * proxy asks in the edge runtime — where `next/headers` does not exist — and
 * the server actions ask in Node. Both hand over what they already have.
 *
 * Order matters. `cf-connecting-ip` and `x-real-ip` are written by the proxy in
 * front of the app and overwritten on every request, so a client cannot forge
 * them. `x-forwarded-for` is a chain the client's own value can be prepended
 * to, so it comes last and is only as trustworthy as the deployment: behind
 * Cloudflare or Vercel it is fine, and directly exposed to the internet nothing
 * here is. That is a limit of the rate limiting built on it, not a hole in it —
 * the worst a forged address buys is the same thing a real second address would.
 */
const IP_HEADERS = [
  "cf-connecting-ip",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
] as const;

/**
 * The machine itself. Worth singling out because Next's own server fills in
 * `x-forwarded-for` from the socket when nothing upstream did, so "no address
 * was forwarded" arrives looking like a perfectly good address — the same one,
 * for everybody. Counting against that would file the whole site under one
 * tally: every visitor spending the same budget, and a health check on the same
 * host able to rate-limit real people out.
 *
 * So it is read as "nothing was forwarded", which is what it means. In
 * development that is every request; in production it is the sign that whatever
 * sits in front of the app is not passing the visitor's address on, and that is
 * the thing to fix rather than to work around here.
 */
function isLoopback(address: string): boolean {
  return (
    address === "::1" ||
    address === "0.0.0.0" ||
    address === "localhost" ||
    address.startsWith("127.") ||
    address.startsWith("::ffff:127.")
  );
}

export function clientIp(headers: Headers): string | null {
  for (const name of IP_HEADERS) {
    const value = headers.get(name);
    if (!value) continue;

    // "client, proxy1, proxy2" — the client is the leftmost entry.
    const first = value.split(",")[0]?.trim();
    if (first) return isLoopback(first) ? null : first;
  }

  return null;
}
