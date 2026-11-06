"use client";

import { useActionState } from "react";
import { Lock, LockKeyhole, ShieldCheck } from "lucide-react";

import { AuthSubmitButton, FieldHint, FieldLabel, PasswordInput } from "@/components/auth/auth-ui";
import { PASSWORD_MIN_LENGTH } from "@/lib/account";
import { resetPassword } from "@/lib/actions/auth";

export function ResetPasswordForm({ username }: { username: string | null }) {
  const [state, formAction, isPending] = useActionState(resetPassword, undefined);

  return (
    <div className="relative flex w-full max-w-md flex-col gap-5">
      <header className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-surface-high/70 to-transparent px-4 pb-2 pt-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-high shadow-lg">
          <ShieldCheck className="size-8 text-primary" />
        </span>
        <span className="label-caps rounded bg-[#ae05c6]/25 px-2 py-0.5 text-neon">Nueva contraseña</span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Elige tu nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">
          {username ? (
            <>
              Para la cuenta <span className="font-semibold text-foreground">@{username}</span>. La
              usarás junto con tu usuario la próxima vez que entres.
            </>
          ) : (
            "La usarás junto con tu usuario la próxima vez que entres."
          )}
        </p>
      </header>

      <section className="rounded-2xl bg-surface-low p-5 shadow-[0_0_48px_-16px_rgba(208,188,255,0.35)] ring-1 ring-border">
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="password" icon={Lock}>
              Nueva contraseña
            </FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="••••••••"
              required
            />
            <FieldHint>Mínimo {PASSWORD_MIN_LENGTH} caracteres.</FieldHint>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="passwordConfirm" icon={LockKeyhole}>
              Repite la contraseña
            </FieldLabel>
            <PasswordInput
              id="passwordConfirm"
              name="passwordConfirm"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="••••••••"
              required
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <AuthSubmitButton disabled={isPending}>
            <ShieldCheck className="size-5" />
            {isPending ? "Guardando…" : "Guardar y entrar"}
          </AuthSubmitButton>
        </form>
      </section>
    </div>
  );
}
