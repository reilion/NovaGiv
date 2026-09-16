"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/account/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/account";
import { updatePassword } from "@/lib/actions/account";

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>
          Pedimos la actual para que nadie pueda cambiarla desde una sesión que dejaste abierta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Remounted on every new notice so the fields come back empty. */}
        <form key={state?.notice ?? "idle"} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="current-password" className="text-sm font-medium text-foreground">
              Contraseña actual
            </label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-sm font-medium text-foreground">
              Nueva contraseña
            </label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <p className="text-xs text-muted-foreground">
              Mínimo {PASSWORD_MIN_LENGTH} caracteres.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password-confirm" className="text-sm font-medium text-foreground">
              Repite la nueva contraseña
            </label>
            <Input
              id="new-password-confirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
          </div>

          <FormMessage state={state} />

          <Button type="submit" disabled={isPending} variant="outline" className="h-9 self-start">
            {isPending ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
