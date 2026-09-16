import Link from "next/link";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        <Button render={<Link href="/login" />} variant="ghost" size="sm">
          Ingresar
        </Button>
        <Button render={<Link href="/register" />} size="sm">
          Crear cuenta
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button render={<Link href="/account" />} variant="ghost" size="sm">
        <UserRound className="size-4" />
        {account.username}
      </Button>

      {account.role === "admin" && (
        <Button render={<Link href="/admin" />} variant="outline" size="sm">
          <ShieldCheck className="size-4" />
          Panel
        </Button>
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
