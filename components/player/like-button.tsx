"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Heart } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { toggleVideoLike } from "@/lib/actions/likes";
import { formatLikesLabel } from "@/lib/text";
import { loginPath } from "@/lib/url";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  mediaItemId: string;
  /** Omitted for a collection's own video: a movie, karaoke or especial. */
  episodeId?: string;
  likes: number;
  liked: boolean;
  /** False while nobody is signed in — the button turns into a way to do that. */
  canLike: boolean;
}

/**
 * The like on the video currently playing. Mounted with a key of that video's
 * id (see the player modal), so switching episodes gets a button that starts
 * from the new video's own state instead of syncing it through an effect.
 */
export function LikeButton({ mediaItemId, episodeId, likes, liked, canLike }: LikeButtonProps) {
  const [state, setState] = useState({ liked, likes });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!canLike) {
    // Back to this very video once they are in: the open player is part of the
    // URL, so the `play` param survives the round trip through the login form.
    const query = searchParams.toString();
    const href = loginPath(query ? `${pathname}?${query}` : pathname);

    return (
      <Link
        href={href}
        title="Inicia sesión para dar me gusta"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
      >
        <Heart className="size-4" />
        {state.likes > 0 && <span>{state.likes}</span>}
        <span className="hidden sm:inline">Me gusta</span>
      </Link>
    );
  }

  function toggle() {
    const previous = state;

    // Flipped before the round trip: the count is one number on a button, and
    // waiting on the network to move it makes the click feel broken.
    setState({ liked: !previous.liked, likes: previous.likes + (previous.liked ? -1 : 1) });
    setError(null);

    startTransition(async () => {
      const result = await toggleVideoLike(mediaItemId, episodeId);

      if (result.error) {
        setState(previous);
        setError(result.error);
        return;
      }

      setState({ liked: result.liked, likes: result.likes });
    });
  }

  return (
    <Button
      type="button"
      onClick={toggle}
      disabled={isPending}
      variant={state.liked ? "secondary" : "outline"}
      size="sm"
      className={cn("shrink-0", state.liked && "text-primary")}
      aria-pressed={state.liked}
      title={error ?? formatLikesLabel(state.likes)}
    >
      <Heart className={cn("size-4", state.liked && "fill-current")} />
      {state.likes > 0 && <span>{state.likes}</span>}
      <span className="hidden sm:inline">{state.liked ? "Te gusta" : "Me gusta"}</span>
    </Button>
  );
}
