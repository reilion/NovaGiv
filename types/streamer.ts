export type SocialPlatform = "twitch" | "youtube" | "website" | "discord" | "x";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  label?: string;
}

export interface StreamerProfile {
  name: string;
  handle?: string;
  avatarUrl: string;
  bannerUrl?: string;
  isLive: boolean;
  liveTitle?: string;
  bio?: string;
  socials: SocialLink[];
}
