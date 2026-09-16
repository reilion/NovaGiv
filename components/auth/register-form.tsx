"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_INPUT_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/account";
import { signUp } from "@/lib/actions/auth";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(signUp, undefined);

  // Set only when the project requires confirming the address: the account is
  // created but there is no session yet, so there is nothing to redirect to.
  if (state?.notice) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-5 text-primary" />
            Revisa tu correo
          </CardTitle>
          <CardDescription>{state.notice}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/login" />} className="h-9 w-full">
            Ir a iniciar sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          Elige un usuario y una contraseña. El correo solo se usa para crear la cuenta y
          recuperarla.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
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
            <p className="text-xs text-muted-foreground">
              Entre {USERNAME_MIN_LENGTH} y {USERNAME_MAX_LENGTH} caracteres: letras, números o
              guion bajo. Con este entras después.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Correo
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
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
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <p className="text-xs text-muted-foreground">
              Mínimo {PASSWORD_MIN_LENGTH} caracteres.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="passwordConfirm" className="text-sm font-medium text-foreground">
              Repite la contraseña
            </label>
            <Input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={isPending} className="mt-2 h-9">
            {isPending ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
