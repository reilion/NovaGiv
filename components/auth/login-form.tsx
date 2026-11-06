"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Bookmark,
  Compass,
  Drama,
  Heart,
  Info,
  Lock,
  LogIn,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  AuthSubmitButton,
  FieldHint,
  FieldLabel,
  FieldTag,
  IconInput,
  PasswordInput,
  PerkList,
  type Perk,
} from "@/components/auth/auth-ui";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { USERNAME_INPUT_PATTERN, USERNAME_MAX_LENGTH } from "@/lib/account";
import { signIn } from "@/lib/actions/auth";
import { isTurnstileEnabled } from "@/lib/turnstile/config";

const PERKS: Perk[] = [
  {
    icon: RefreshCw,
    title: "Historial entre dispositivos",
    text: "Retoma «Seguir viendo» donde lo dejaste, en el móvil o en el PC.",
  },
  {
    icon: Bookmark,
    title: "Listas de «Ver después»",
    text: "Guarda transmisiones largas y maratones temáticos en un solo toque.",
  },
  {
    icon: Heart,
    title: "Comunidad y votos",
    text: "Apoya los mejores momentos con tus Me gusta.",
  },
];

export function LoginForm({ next, warning }: { next?: string; warning?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, undefined);

  // Starts ready when there is no challenge to wait on, so a site running
  // without Turnstile keeps a button that works from the first paint.
  const [captchaReady, setCaptchaReady] = useState(!isTurnstileEnabled);

  return (
    <div className="relative flex w-full max-w-md flex-col gap-5">
      <header className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-surface-high/70 to-transparent px-4 pb-2 pt-6 text-center">
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-surface-high shadow-lg">
          <Drama className="size-8 text-primary" />
          <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-live ring-4 ring-background" />
        </span>
        <span className="label-caps rounded bg-[#ae05c6]/25 px-2 py-0.5 text-neon">Sala de resubidos</span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">¡Qué bueno verte de nuevo!</h1>
        <p className="text-sm text-muted-foreground">
          Accede para sincronizar tu historial, retomar donde lo dejaste y guardar tus directos
          favoritos.
        </p>
      </header>

      <section className="rounded-2xl bg-surface-low p-5 shadow-[0_0_48px_-16px_rgba(208,188,255,0.35)] ring-1 ring-border">
        {warning && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {warning}
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          {next && <input type="hidden" name="next" value={next} />}

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="username" icon={UserRound} aside={<FieldTag>Solo usuario</FieldTag>}>
              Nombre de usuario
            </FieldLabel>
            <IconInput
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              pattern={USERNAME_INPUT_PATTERN}
              maxLength={USERNAME_MAX_LENGTH}
              placeholder="tu_usuario"
              required
              leading={<AtSign className="size-4" />}
            />
            <FieldHint icon={Info}>Usa tu usuario de NovaGiv (no el correo).</FieldHint>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel
              htmlFor="password"
              icon={Lock}
              aside={
                <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              }
            >
              Contraseña
            </FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          {/* `state` is a new object for every answer the action gives, which
              is the signal the widget needs to swap its spent token for a
              fresh one. A sign-in that works redirects and never returns one. */}
          <TurnstileWidget action="login" resetOn={state} onReadyChange={setCaptchaReady} />

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          {/* Held shut for the second or so a challenge takes. Submitting in
              that gap would send an empty token and come back complaining
              about the captcha, which after a mistyped password is the most
              confusing answer the form could give. */}
          <AuthSubmitButton disabled={isPending || !captchaReady}>
            <LogIn className="size-5" />
            {isPending ? "Ingresando…" : captchaReady ? "Entrar a mi cuenta" : "Verificando…"}
          </AuthSubmitButton>
        </form>
      </section>

      <PerkList title="Ventajas de tu perfil en NovaGiv" icon={Sparkles} perks={PERKS} />

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-surface-low p-4 ring-1 ring-border">
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-semibold text-foreground">¿No tienes cuenta aún?</p>
          <p className="text-xs text-muted-foreground">Únete a la comunidad en menos de 1 min.</p>
        </div>
        <Link
          href="/register"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-high px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-highest"
        >
          Crear cuenta
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Compass className="size-4" />
        Continuar como invitado y explorar el catálogo
      </Link>
    </div>
  );
}
