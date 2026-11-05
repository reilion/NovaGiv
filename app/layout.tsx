import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";

import { HideOnRoutes } from "@/components/layout/hide-on-routes";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// The design's data face: stream dates, episode numbers, counters and badges.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const description =
  "Catálogo organizado de resubidos de transmisiones: películas, series, anime, especiales y karaokes.";

export const metadata: Metadata = {
  // Makes every relative `canonical` and og:url below resolve to an absolute
  // one — a shared link has to carry the canonical host, not whatever preview
  // domain happened to serve the page.
  metadataBase: new URL(getPublicSiteUrl()),
  title: "NovaGiv | Streams, Series y Anime en un solo lugar",
  description,
  openGraph: {
    title: "NovaGiv",
    description,
    siteName: "NovaGiv",
    type: "website",
    locale: "es_ES",
  },
  twitter: { card: "summary_large_image" },
};

/** /admin brings its own chrome (a sidebar), so the public header and footer stay out of it. */
const OWN_CHROME_ROUTES = ["/admin"];

/**
 * `modal` is the parallel slot holding the player dialog. It is empty on every
 * route except an intercepted /v/[slug] (see app/@modal), where it renders over
 * `children` — which keeps showing the catalog, filters and scroll position
 * intact. Typed through Next's generated `LayoutProps` so adding or removing a
 * slot can never leave this signature out of step with the route tree.
 */
export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <HideOnRoutes prefixes={OWN_CHROME_ROUTES}>
          <SiteHeader />
        </HideOnRoutes>
        {children}
        <HideOnRoutes prefixes={OWN_CHROME_ROUTES}>
          <SiteFooter />
        </HideOnRoutes>
        {modal}
      </body>
    </html>
  );
}
