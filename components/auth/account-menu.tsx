import Link from "next/link";
import { Heart, LogOut, ShieldCheck, UserRound } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { getAccount } from "@/lib/auth";

/** Placeholder of the same height, so the header does not jump when it loads. */
export function AccountMenuSkeleton() {
  return <div className="h-7" aria-hidden />;
}

/**
 * Sign in / sign up links for a visitor, and who-am-I plus a way out for an
 * account. Rendered inside a Suspense boundary in the profile header: it needs
 * the session, and the rest of the header should not wait on that round trip.
 */
export async function AccountMenu() {
  const account = await getAccount();

  if (!account) {
    return (
      <div className="flex items-center gap-2">
        {/* A link styled as a button, not a Button rendering a link: Base UI's
            Button gives whatever it renders button semantics, and a navigation
            announced as a button is the wrong thing for a screen reader. */}
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Ingresar
        </Link>
        <Link href="/register" className={buttonVariants({ size: "sm" })}>
          Crear cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* The one shortcut worth a permanent spot: everything else an account
          can reach lives on /account. */}
      <Link
        href="/me-gusta"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        title="Mis me gusta"
      >
        <Heart className="size-4" />
        <span className="sr-only sm:not-sr-only">Me gusta</span>
      </Link>

      <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <UserRound className="size-4" />
        {account.username}
      </Link>

      {account.role === "admin" && (
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ShieldCheck className="size-4" />
          Panel
        </Link>
      )}

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut className="size-4" />
          Salir
        </Button>
      </form>
    </div>
  );
}
