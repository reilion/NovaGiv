import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { getPublicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        {modal}
      </body>
    </html>
  );
}
