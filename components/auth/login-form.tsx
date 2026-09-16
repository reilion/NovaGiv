"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { USERNAME_INPUT_PATTERN, USERNAME_MAX_LENGTH } from "@/lib/account";
import { signIn } from "@/lib/actions/auth";

export function LoginForm({ next, warning }: { next?: string; warning?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Entra con tu usuario y contraseña.</CardDescription>
      </CardHeader>
      <CardContent>
        {warning && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {warning}
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          {next && <input type="hidden" name="next" value={next} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Usuario
            </label>
            <Input
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
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Contraseña
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={isPending} className="mt-2 h-9">
            {isPending ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Crear una
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
