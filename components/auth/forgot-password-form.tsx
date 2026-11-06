"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, CheckCircle2, Info, KeyRound, Mail, Send, UserRound } from "lucide-react";

import {
  AuthSubmitButton,
  FieldHint,
  FieldLabel,
  IconInput,
} from "@/components/auth/auth-ui";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { requestPasswordReset } from "@/lib/actions/auth";
import { isTurnstileEnabled } from "@/lib/turnstile/config";

export function ForgotPasswordForm({ warning }: { warning?: string }) {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, undefined);
  const [captchaReady, setCaptchaReady] = useState(!isTurnstileEnabled);

  return (
    <div className="relative flex w-full max-w-md flex-col gap-5">
      <header className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-surface-high/70 to-transparent px-4 pb-2 pt-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-high shadow-lg">
          <KeyRound className="size-8 text-primary" />
        </span>
        <span className="label-caps rounded bg-[#ae05c6]/25 px-2 py-0.5 text-neon">Recuperar acceso</span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">¿Olvidaste tu contraseña?</h1>
        <p className="text-sm text-muted-foreground">
          Escribe tu usuario o el correo de tu cuenta y te enviaremos un enlace para elegir una nueva.
        </p>
      </header>

      <section className="rounded-2xl bg-surface-low p-5 shadow-[0_0_48px_-16px_rgba(208,188,255,0.35)] ring-1 ring-border">
        {warning && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{warning}</p>
        )}

        {state?.notice ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <p className="text-sm text-muted-foreground">{state.notice}</p>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="identifier" icon={UserRound}>
                Usuario o correo
              </FieldLabel>
              <IconInput
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tu_usuario o tu@correo.com"
                required
                leading={<Mail className="size-4" />}
              />
              <FieldHint icon={Info}>El enlace llega al correo con el que creaste la cuenta.</FieldHint>
            </div>

            <TurnstileWidget action="recover" resetOn={state} onReadyChange={setCaptchaReady} />

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

            <AuthSubmitButton disabled={isPending || !captchaReady}>
              <Send className="size-5" />
              {isPending ? "Enviando…" : captchaReady ? "Enviar enlace" : "Verificando…"}
            </AuthSubmitButton>
          </form>
        )}
      </section>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
