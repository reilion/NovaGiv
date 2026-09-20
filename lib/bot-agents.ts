/**
 * What kind of client a `User-Agent` claims to be.
 *
 * Read that word "claims" literally: a header anybody can set is not proof of
 * anything, and nothing here should be mistaken for a security boundary. What
 * it is good for is the bulk of the traffic that does not bother lying —
 * scraping frameworks and one-line HTTP clients announce themselves plainly —
 * and for deciding which request budget applies to the rest. Whoever does lie
 * still lands in a budget (see lib/bot-guard.ts), which is the actual floor
 * under all of this.
 */
export type AgentKind =
  /** A search engine or a link-preview fetcher: welcome, on a crawler's budget. */
  | "crawler"
  /** An HTTP client or scraping framework wearing no disguise: turned away. */
  | "tool"
  /** Everything else, which is what a person browsing looks like. */
  | "browser";

/**
 * Bots the site wants: they are what puts a title in a search result, and what
 * turns a shared link into a preview card. Matched before TOOLS, so a crawler
 * whose string happens to contain one of those tokens stays a crawler.
 */
const CRAWLERS = [
  // Search.
  "googlebot",
  "google-inspectiontool",
  "storebot-google",
  "adsbot-google",
  "bingbot",
  "bingpreview",
  "msnbot",
  "slurp",
  "duckduckbot",
  "duckassistbot",
  "baiduspider",
  "yandexbot",
  "applebot",
  "petalbot",
  "sogou",
  "seznambot",
  "qwantbot",
  // Link previews — these are what draws the card when a title is shared.
  "facebookexternalhit",
  "facebookcatalog",
  "meta-externalfetcher",
  "twitterbot",
  "linkedinbot",
  "pinterest",
  "redditbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "slackbot",
  "slack-imgproxy",
  "embedly",
  "skypeuripreview",
  "vkshare",
  "google-pagerenderer",
  // Archives.
  "ia_archiver",
  "archive.org_bot",
  // --- AI crawlers -------------------------------------------------------
  // Here on purpose rather than in TOOLS below: they are read as "a bot that
  // says who it is", not "a bot to shut out", and shutting them out is a
  // decision about the site and not about robots. Move any of these into
  // TOOLS to turn it away, or add it to app/robots.ts to ask it to stay out
  // of whole sections — the first is a wall, the second a request.
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "claude-searchbot",
  "claude-user",
  "perplexitybot",
  "perplexity-user",
  "google-extended",
  "applebot-extended",
  "ccbot",
  "bytespider",
  "amazonbot",
  "meta-externalagent",
  "cohere-ai",
  "diffbot",
  "timpibot",
  "youbot",
] as const;

/**
 * Clients that are not a browser and are not pretending to be one. Two groups,
 * and both of them go the same way:
 *
 * - generic HTTP clients and scraping frameworks, which is what somebody
 *   copying the catalogue reaches for first;
 * - the commercial SEO crawlers, which are not search engines — they crawl the
 *   whole site to resell what is on it, and they are the heaviest traffic here
 *   that nobody asked for.
 *
 * Every entry has to be something no real browser would ever send. That rule is
 * what keeps this list from quietly costing the site a visitor, and it is worth
 * more than any single entry in it: when in doubt, leave it out and let the
 * request budget deal with it.
 */
const TOOLS = [
  // Generic HTTP clients.
  "curl/",
  "wget",
  "libwww-perl",
  "lwp::simple",
  "python-requests",
  "python-urllib",
  "python-httpx",
  "python/",
  "aiohttp",
  "httpx/",
  "node-fetch",
  "axios/",
  "got (https://github.com/sindresorhus/got)",
  "go-http-client",
  "java/",
  "apache-httpclient",
  "okhttp",
  "guzzlehttp",
  "php-curl",
  "ruby",
  "rest-client",
  "typhoeus",
  "winhttp",
  "http_request2",
  "postmanruntime",
  "insomnia",
  // Scraping and automation.
  "scrapy",
  "httrack",
  "mechanize",
  "beautifulsoup",
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "webdriver",
  "crawler4j",
  "nutch",
  // Vulnerability scanners: never a visitor, always somebody looking for a way in.
  "zgrab",
  "masscan",
  "nmap",
  "nikto",
  "sqlmap",
  "wpscan",
  "nuclei",
  "dirbuster",
  "gobuster",
  "feroxbuster",
  // Commercial SEO crawlers.
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "blexbot",
  "dataforseobot",
  "serpstatbot",
  "megaindex",
  "seokicks",
  "zoominfobot",
  "barkrowler",
  "magpie-crawler",
  "linkdexbot",
  "sistrix",
  "screaming frog",
] as const;

export function classifyUserAgent(userAgent: string | null): AgentKind {
  const agent = userAgent?.trim().toLowerCase() ?? "";

  // No header at all. Every browser sends one, and so does every crawler that
  // wants to be let in; what is left is a script that did not think to.
  if (!agent) return "tool";

  if (CRAWLERS.some((token) => agent.includes(token))) return "crawler";
  if (TOOLS.some((token) => agent.includes(token))) return "tool";

  return "browser";
}
