"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/account/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { USERNAME_INPUT_PATTERN, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/account";
import { updateUsername } from "@/lib/actions/account";

export function UsernameForm({ username }: { username: string }) {
  const [state, formAction, isPending] = useActionState(updateUsername, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nombre de usuario</CardTitle>
        <CardDescription>
          Con este entras a tu cuenta. Si lo cambias, el anterior deja de servir para iniciar
          sesión.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="username"
              name="username"
              type="text"
              aria-label="Nombre de usuario"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              pattern={USERNAME_INPUT_PATTERN}
              maxLength={USERNAME_MAX_LENGTH}
              defaultValue={username}
              required
            />
            <Button type="submit" disabled={isPending} className="h-9 sm:w-32">
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Entre {USERNAME_MIN_LENGTH} y {USERNAME_MAX_LENGTH} caracteres: letras, números o guion
            bajo.
          </p>

          <FormMessage state={state} />
        </form>
      </CardContent>
    </Card>
  );
}
