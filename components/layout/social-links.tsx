import type { ComponentType } from "react";
import { Globe, MessageCircle, PlayCircle, Tv, X } from "lucide-react";

import type { SocialPlatform } from "@/types/streamer";

export interface SocialMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// lucide-react has no brand glyphs, so each platform gets a generic icon.
export const SOCIAL_META: Record<SocialPlatform, SocialMeta> = {
  twitch: { label: "Twitch", icon: Tv },
  youtube: { label: "YouTube", icon: PlayCircle },
  website: { label: "Sitio web", icon: Globe },
  discord: { label: "Discord", icon: MessageCircle },
  x: { label: "X / Twitter", icon: X },
};
