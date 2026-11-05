"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AtSign,
  Eye,
  History,
  Info,
  Lock,
  Mail,
  MailCheck,
  Rocket,
  Ticket,
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
import { buttonVariants } from "@/components/ui/button";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_INPUT_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/account";
import { signUp } from "@/lib/actions/auth";
import { isTurnstileEnabled } from "@/lib/turnstile/config";
import { cn } from "@/lib/utils";

const PERKS: Perk[] = [
  {
    icon: History,
    title: "Historial exacto y reanudación",
    text: "Recuerda el episodio donde lo dejaste, sin perderte nunca en maratones largos.",
  },
  {
    icon: Ticket,
    title: "Tus listas y Me gusta",
    text: "Guarda directos para después y apoya tus noches de cine favoritas.",
  },
];

const STRENGTH_LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"] as const;

/**
 * A rough 0–4 score for the meter under the password: length plus variety.
 * Only a hint for the person typing — the server keeps its own rules.
 */
function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = value.length >= PASSWORD_MIN_LENGTH ? 1 : 0;
  if (value.length >= PASSWORD_MIN_LENGTH + 4) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(score, 4);
}

function StrengthMeter({ value }: { value: string }) {
  const score = passwordStrength(value);
  if (!value) return null;

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="label-code flex items-center justify-between text-muted-foreground">
        <span>Fortaleza de seguridad:</span>
        <span className={cn("flex items-center gap-1", score >= 3 ? "text-neon" : "text-tertiary")}>
          <span className="size-1.5 rounded-full bg-current" />
          {STRENGTH_LABELS[score]}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 rounded-full transition-colors",
              step <= score ? (step === 4 ? "bg-neon" : "bg-primary") : "bg-surface-highest"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** `warning` mirrors LoginForm's: shown above the fields, before anything is typed. */
export function RegisterForm({ warning }: { warning?: string }) {
  const [state, formAction, isPending] = useActionState(signUp, undefined);

  // Mirrors LoginForm's: ready from the start when there is no challenge.
  const [captchaReady, setCaptchaReady] = useState(!isTurnstileEnabled);
  const [password, setPassword] = useState("");

  // Set only when the project requires confirming the address: the account is
  // created but there is no session yet, so there is nothing to redirect to.
  if (state?.notice) {
    return (
      <section className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface-low p-6 shadow-[0_0_48px_-16px_rgba(208,188,255,0.35)] ring-1 ring-border">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <MailCheck className="size-6 text-primary" />
          Revisa tu correo
        </h1>
        <p className="text-sm text-muted-foreground">{state.notice}</p>
        <Link href="/login" className={cn(buttonVariants(), "h-11 w-full")}>
          Ir a iniciar sesión
        </Link>
      </section>
    );
  }

  return (
    <div className="relative flex w-full max-w-md flex-col gap-5">
      <header className="relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-transparent via-transparent to-[#ae05c6]/15 pt-2">
        <span className="label-caps flex w-fit items-center gap-1.5 rounded-full bg-surface-high px-2.5 py-1 text-foreground">
          <span className="size-2 rounded-full bg-live" />
          Comunidad NovaGiv · Acceso gratuito
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Crea tu cuenta de <span className="text-primary">NovaGiv</span>
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Únete en segundos para guardar tu historial de reproducciones, retomar el reproductor
          donde lo dejaste y armar tus listas.
        </p>
      </header>

      <section className="rounded-2xl bg-surface-low p-5 shadow-[0_0_48px_-16px_rgba(208,188,255,0.35)] ring-1 ring-border">
        {warning && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {warning}
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="username" aside={<FieldTag>Público</FieldTag>}>
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
            <FieldHint>
              {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} caracteres (a-z, 0-9, _). Con este entras
              después.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="email" aside={<FieldTag>Solo recuperación</FieldTag>}>
              Correo electrónico
            </FieldLabel>
            <IconInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              required
              leading={<Mail className="size-4" />}
            />
            <FieldHint icon={Info}>
              No lo usamos para iniciar sesión, solo para crear la cuenta y recuperarla.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel
              htmlFor="password"
              aside={
                <span className="label-caps text-outline">Mínimo {PASSWORD_MIN_LENGTH} car.</span>
              }
            >
              Contraseña
            </FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              leading={<Lock className="size-4" />}
            />
            <StrengthMeter value={password} />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="passwordConfirm">Repite la contraseña</FieldLabel>
            <PasswordInput
              id="passwordConfirm"
              name="passwordConfirm"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              leading={<Lock className="size-4" />}
            />
          </div>

          {/* Mirrors LoginForm's: every answer the action gives is a new
              object, and each one means the token just submitted is spent. */}
          <TurnstileWidget action="register" resetOn={state} onReadyChange={setCaptchaReady} />

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <AuthSubmitButton disabled={isPending || !captchaReady}>
            {isPending ? "Creando cuenta…" : captchaReady ? "Crear mi cuenta gratis" : "Verificando…"}
            {!isPending && captchaReady && <Rocket className="size-5" />}
          </AuthSubmitButton>
        </form>
      </section>

      <PerkList title="¿Por qué registrarte en NovaGiv?" icon={Info} perks={PERKS} />

      <div className="flex flex-col items-center gap-3 py-2 text-sm">
        <p className="text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Iniciar sesión
          </Link>
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Eye className="size-4" />
          Volver al catálogo como invitado
        </Link>
      </div>
    </div>
  );
}
