"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  TURNSTILE_FIELD,
  TURNSTILE_SITE_KEY,
  type TurnstileAction,
} from "@/lib/turnstile/config";

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Explicit rendering, not the `cf-turnstile` class the docs lead with: a token
 * is spent by the submit that carries it, so the widget has to be reset before
 * the next attempt — and only an explicit render hands back the id that takes.
 */
const CALLBACK_NAME = "onloadNovagivTurnstile";
const SCRIPT_SRC = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${CALLBACK_NAME}`;

/**
 * Module-level, so the login form and the sign-up form — and a remount of
 * either — share one copy of the script instead of each appending their own.
 */
let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (loading) return loading;

  loading = new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    // The `onload=` parameter above, rather than the script's own load event:
    // that one fires before Turnstile has finished putting its API on `window`.
    (window as unknown as Record<string, unknown>)[CALLBACK_NAME] = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile cargó sin exponer su API."));
    };

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("No se pudo cargar el script de Turnstile."));
    document.head.appendChild(script);
  });

  // A blocked or failed load should not poison every later attempt: forget it,
  // so reopening the form tries again instead of showing the same dead widget.
  loading.catch(() => {
    loading = undefined;
  });

  return loading;
}

interface TurnstileWidgetProps {
  /**
   * Which form this is. It reaches the server action inside Cloudflare's
   * verdict, which compares it with the action doing the verifying.
   */
  action: TurnstileAction;
  /**
   * Anything whose identity changes once per answer from the server — the
   * action state of the surrounding form is exactly that. Each answer means the
   * token that went up with the submit has been spent, and a form still showing
   * it would send the same one again; Cloudflare refuses a duplicate, which
   * would turn one mistyped password into a form that never works again.
   *
   * Undefined until the first answer comes back, which is what keeps the
   * challenge that drew on mount from being thrown away unused.
   */
  resetOn?: unknown;
  /**
   * Whether the form may be submitted yet. False while a challenge is running
   * and there is no token to send — a submit made then would be refused for
   * the captcha rather than answered, which after a mistyped password reads as
   * the site losing track of what it was asked.
   *
   * It turns true again the moment a token exists *or* the moment it is clear
   * none is coming: a widget that a content blocker kept from loading should
   * leave a form that can still be submitted and told no by the server, never
   * a button that is disabled forever with nothing on screen to explain it.
   */
  onReadyChange?: (ready: boolean) => void;
}

/**
 * The Cloudflare Turnstile challenge on the auth forms. Renders nothing at all
 * when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, which is what lets the site run
 * without a Cloudflare account — see lib/turnstile/config.ts.
 *
 * It writes its token into a hidden `cf-turnstile-response` field of the form
 * it sits in, so the surrounding form needs to do nothing but contain it; the
 * server actions read that field through verifyTurnstile().
 */
export function TurnstileWidget({ action, resetOn, onReadyChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);

  // An effect event, so the effect below does not list the parent's callback
  // among its dependencies: a parent that passes a new closure on every render
  // would otherwise tear the widget down and build a new one each time.
  const reportReady = useEffectEvent((ready: boolean) => {
    onReadyChange?.(ready);
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let cancelled = false;
    const report = (ready: boolean) => {
      if (!cancelled) reportReady(ready);
    };

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "auto",
          language: "es",
          size: "flexible",
          // Five minutes in, the token is stale; let Turnstile swap it for a
          // fresh one rather than let the form submit one already refused.
          "refresh-expired": "auto",
          "response-field-name": TURNSTILE_FIELD,
          callback: () => {
            setUnavailable(false);
            report(true);
          },
          "error-callback": () => {
            setUnavailable(true);
            // Opening the form back up rather than holding it shut: whatever
            // went wrong is Cloudflare's or the network's, and the person in
            // front of it should still get to press the button and be told
            // something. Returning false leaves Turnstile its own retry.
            report(true);
            return false;
          },
          "timeout-callback": () => report(true),
        });
      })
      .catch(() => {
        setUnavailable(true);
        report(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [action]);

  useEffect(() => {
    if (resetOn === undefined || !widgetIdRef.current) return;

    // Shut the form while the replacement challenge runs. `callback` above
    // reopens it, a second or so later, once there is a token worth sending.
    reportReady(false);
    window.turnstile?.reset(widgetIdRef.current);
  }, [resetOn]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* The height the widget settles at, held from the start so the button
          below it does not jump once the challenge draws. */}
      <div ref={containerRef} className="min-h-[65px]" />

      {unavailable && (
        <p className="text-xs text-muted-foreground">
          No se pudo cargar la verificación anti-robots. Revisa tu conexión o algún bloqueador de
          contenido, y recarga la página.
        </p>
      )}
    </div>
  );
}
