import { ImageResponse } from "next/og";

import { getMediaBySlug } from "@/lib/queries";
import { formatStreamRange } from "@/lib/stream-date";
import { formatViewsLabel } from "@/lib/text";
import { isEpisodic, MEDIA_TYPE_LABELS, totalViewsOf } from "@/types/media";

export const alt = "Ficha del título en NovaGiv";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Mirrors the tokens in app/globals.css — this renders outside the stylesheet. */
const COLORS = {
  background: "#09090b",
  card: "#18181b",
  foreground: "#f4f4f5",
  muted: "#a1a1aa",
  primary: "#8b5cf6",
};

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * Inlined as a data URL rather than handed to the renderer as a remote `src`.
 * Posters come from half a dozen third-party CDNs (see next.config.ts), and one
 * of them refusing the request would fail the whole image; fetching it here
 * means a poster that cannot be loaded just falls back to the plain card.
 */
async function loadPoster(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const type = response.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return undefined;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * The card that shows up when a title is pasted into Discord, WhatsApp or X.
 * Next picks this file up from the route folder and adds it to the metadata of
 * app/v/[slug]/page.tsx on its own.
 */
export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getMediaBySlug(slug);

  if (!item) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.background,
            color: COLORS.foreground,
            fontSize: 64,
          }}
        >
          NovaGiv
        </div>
      ),
      size
    );
  }

  const poster = await loadPoster(item.posterUrl);
  const streamRange = formatStreamRange(item.firstStreamedAt, item.lastStreamedAt);
  const episodeCount = item.episodes?.length ?? 0;

  const facts = [
    MEDIA_TYPE_LABELS[item.type],
    isEpisodic(item.type) ? `${episodeCount} episodios` : item.duration,
    item.year ? String(item.year) : undefined,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: COLORS.background,
          color: COLORS.foreground,
          padding: 56,
          gap: 48,
        }}
      >
        {poster ? (
          /* This tree is rendered by Satori into a PNG, not by a browser:
             next/image means nothing here, and `<img>` is the only image
             element it understands. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            width={320}
            height={480}
            style={{ borderRadius: 24, objectFit: "cover" }}
            alt=""
          />
        ) : (
          <div
            style={{
              width: 320,
              height: 480,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 24,
              background: COLORS.card,
              color: COLORS.primary,
              fontSize: 96,
            }}
          >
            {item.title.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: COLORS.primary }} />
            <div style={{ fontSize: 26, color: COLORS.primary, letterSpacing: 2 }}>NOVAGIV</div>
          </div>

          <div style={{ fontSize: 60, lineHeight: 1.1 }}>{clamp(item.title, 64)}</div>

          {facts.length > 0 && (
            <div style={{ fontSize: 30, color: COLORS.muted }}>{facts.join("  ·  ")}</div>
          )}

          {/* Every text node here is a single child on purpose: Satori refuses
              a div holding more than one unless it is explicitly a flex box. */}
          {streamRange && (
            <div style={{ fontSize: 28, color: COLORS.muted }}>{`Emitido ${streamRange}`}</div>
          )}

          <div style={{ fontSize: 26, color: COLORS.muted }}>
            {formatViewsLabel(totalViewsOf(item))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
