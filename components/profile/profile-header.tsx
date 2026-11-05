import Image from "next/image";
import { ExternalLink, MessageCircle, Play } from "lucide-react";

import { LiveDot } from "@/components/layout/site-header";
import { SOCIAL_META } from "@/components/layout/social-links";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { StreamerProfile } from "@/types/streamer";

/**
 * The streamer hero at the top of the catalog. Live, it is a way into the
 * stream (title, rose badge, Twitch call to action); offline, it introduces
 * the archive.
 */
export function ProfileHeader({ profile }: { profile: StreamerProfile }) {
  const twitch = profile.socials.find((social) => social.platform === "twitch");
  const discord = profile.socials.find((social) => social.platform === "discord");
  const headline = profile.isLive && profile.liveTitle ? profile.liveTitle : profile.name;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl bg-surface-low shadow-2xl ring-1 ring-border">
        {profile.bannerUrl && (
          <div className="absolute inset-0">
            <Image src={profile.bannerUrl} alt="" fill priority className="object-cover opacity-15" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-low via-surface-low/90 to-surface-low/60" />
          </div>
        )}
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-1/2 size-80 rounded-full bg-live/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 p-6 lg:p-10 xl:flex-row xl:items-center">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <Avatar className="size-24 rounded-2xl ring-2 ring-primary/40 after:rounded-2xl sm:size-28">
                <AvatarImage src={profile.avatarUrl} alt={profile.name} className="rounded-2xl" />
                <AvatarFallback className="rounded-2xl text-2xl">
                  {profile.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.isLive && (
                <span className="absolute -bottom-2.5 -right-2.5 flex items-center gap-1.5 rounded-full bg-surface-highest px-2 py-0.5 shadow-md">
                  <LiveDot />
                  <span className="label-caps text-tertiary">Live</span>
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {profile.isLive ? (
                  <span className="label-caps flex items-center gap-1.5 rounded bg-live/15 px-2.5 py-1 text-tertiary">
                    <span className="size-1.5 animate-pulse rounded-full bg-live" />
                    En vivo en Twitch
                  </span>
                ) : (
                  <span className="label-caps flex items-center gap-1.5 rounded bg-surface-highest px-2.5 py-1 text-outline">
                    <span className="size-1.5 rounded-full bg-outline" />
                    Offline
                  </span>
                )}
                {profile.handle && <span className="label-code text-muted-foreground">{profile.handle}</span>}
              </div>

              <h1 className="line-clamp-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {headline}
              </h1>
              {profile.bio && (
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{profile.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {profile.socials.map((social) => {
                  const meta = SOCIAL_META[social.platform];
                  const Icon = meta.icon;
                  return (
                    <a
                      key={social.platform}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "label-code flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground",
                        social.platform === "twitch" && "text-primary"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {meta.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {twitch && (
            <div className="flex shrink-0 flex-col gap-2 border-t border-outline-variant/30 pt-6 sm:flex-row xl:flex-col xl:border-l xl:border-t-0 xl:pl-10 xl:pt-0">
              <a
                href={twitch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_-4px_rgba(208,188,255,0.45)] transition-all hover:bg-neon hover:shadow-[0_0_32px_rgba(251,171,255,0.6)]"
              >
                <Play className="size-4 fill-current transition-transform group-hover:scale-110" />
                {profile.isLive ? "Ver directo en Twitch" : "Ir al canal de Twitch"}
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
              {discord && (
                <a
                  href={discord.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label-code inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface px-4 py-2.5 text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
                >
                  <MessageCircle className="size-4 text-neon" />
                  Unirse al Discord
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
