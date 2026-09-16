"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/account/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateEmail } from "@/lib/actions/account";

export function EmailForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(updateEmail, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correo</CardTitle>
        <CardDescription>
          No se usa para entrar, solo para confirmar y recuperar la cuenta. Actualmente:{" "}
          <span className="text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Remounted on every new notice so the password field does not linger
            filled in after a successful change. */}
        <form key={state?.notice ?? "idle"} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-email" className="text-sm font-medium text-foreground">
              Nuevo correo
            </label>
            <Input
              id="new-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email-password" className="text-sm font-medium text-foreground">
              Tu contraseña actual
            </label>
            <Input
              id="email-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <FormMessage state={state} />

          <Button type="submit" disabled={isPending} variant="outline" className="h-9 self-start">
            {isPending ? "Enviando…" : "Cambiar correo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
