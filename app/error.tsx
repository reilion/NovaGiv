"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Last line of defence for the public site. Anything a page throws lands here
 * instead of a blank screen — most plausibly Supabase being unreachable, which
 * `reset()` is worth a try against.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error —", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <TriangleAlert className="size-10 text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Algo se rompió
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No pudimos cargar esta página. Vuelve a intentarlo; si sigue igual, prueba más tarde.
        </p>
        {/* The one piece of the error worth showing: it is what identifies this
            failure in the server logs. */}
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={reset}>
          <RotateCw className="size-4" />
          Reintentar
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ir al catálogo
        </Link>
      </div>
    </div>
  );
}
