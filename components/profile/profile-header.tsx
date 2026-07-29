import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { Globe, MessageCircle, PlayCircle, Tv, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SocialPlatform, StreamerProfile } from "@/types/streamer";

interface SocialMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  className: string;
}

// lucide-react has no brand glyphs, so each platform gets a generic icon
// tinted with that platform's brand color to keep the links recognizable.
const SOCIAL_META: Record<SocialPlatform, SocialMeta> = {
  twitch: {
    label: "Twitch",
    icon: Tv,
    className: "bg-[#9146FF]/15 text-[#9146FF] hover:bg-[#9146FF]/25",
  },
  youtube: {
    label: "YouTube",
    icon: PlayCircle,
    className: "bg-[#FF0000]/15 text-[#FF4444] hover:bg-[#FF0000]/25",
  },
  website: {
    label: "Sitio web",
    icon: Globe,
    className: "bg-primary/15 text-primary hover:bg-primary/25",
  },
  discord: {
    label: "Discord",
    icon: MessageCircle,
    className: "bg-[#5865F2]/15 text-[#8891f5] hover:bg-[#5865F2]/25",
  },
  x: {
    label: "X",
    icon: X,
    className: "bg-foreground/10 text-foreground hover:bg-foreground/20",
  },
};

export function ProfileHeader({ profile }: { profile: StreamerProfile }) {
  return (
    <header className="relative overflow-hidden border-b border-border/60">
      {profile.bannerUrl && (
        <div className="absolute inset-0">
          <Image
            src={profile.bannerUrl}
            alt=""
            fill
            priority
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar className="size-16 ring-2 ring-primary/40 sm:size-20">
              <AvatarImage src={profile.avatarUrl} alt={profile.name} />
              <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {profile.isLive && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-live/70" />
                <span className="relative inline-flex size-4 rounded-full bg-live ring-2 ring-background" />
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {profile.name}
              </h1>
              <Badge
                className={cn(
                  profile.isLive
                    ? "bg-live text-live-foreground [a]:hover:bg-live"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    profile.isLive ? "animate-pulse bg-live-foreground" : "bg-muted-foreground"
                  )}
                />
                {profile.isLive ? "En vivo" : "Offline"}
              </Badge>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              {profile.isLive && profile.liveTitle ? profile.liveTitle : profile.bio}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.socials.map((social) => {
            const meta = SOCIAL_META[social.platform];
            const Icon = meta.icon;
            return (
              <Link
                key={social.platform}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={meta.label}
                title={meta.label}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full transition-colors",
                  meta.className
                )}
              >
                <Icon className="size-4" />
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
