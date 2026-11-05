import Link from "next/link";
import { Bookmark, Heart, History, LogOut, UserRound } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { getAccount } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function AccountMenuSkeleton() {
  return <div className="h-9 w-32" aria-hidden />;
}

const SHORTCUTS = [
  { href: "/me-gusta", label: "Mis me gusta", icon: Heart },
  { href: "/ver-despues", label: "Ver después", icon: Bookmark },
  { href: "/historial", label: "Historial", icon: History },
] as const;

export async function AccountMenu() {
  const account = await getAccount();

  if (!account) {
    return (
      <div className="flex items-center gap-1.5">
        {/* A link styled as a button, not a Button rendering a link: Base UI's
            Button gives whatever it renders button semantics, and a navigation
            announced as a button is the wrong thing for a screen reader. */}
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
        >
          Ingresar
        </Link>
        <Link href="/register" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
          Crear cuenta
        </Link>
        {/* Phones: the round avatar of the design, standing in for both links. */}
        <Link
          href="/login"
          aria-label="Ingresar"
          className="flex size-11 items-center justify-center sm:hidden"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_12px_-2px_rgba(208,188,255,0.4)]">
            <UserRound className="size-[18px]" />
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="hidden items-center gap-0.5 md:flex">
        {SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground"
          >
            <Icon className="size-4" />
          </Link>
        ))}
      </div>

      {account.role === "admin" && (
        <Link
          href="/admin"
          className="label-caps hidden rounded-lg bg-surface px-2 py-1.5 text-primary transition-colors hover:bg-surface-high sm:inline-block"
        >
          Admin
        </Link>
      )}

      <Link
        href="/account"
        className="flex min-h-11 items-center gap-2 rounded-lg py-1 pl-2 pr-1 transition-colors hover:bg-surface-high"
        title="Mi cuenta"
      >
        <span className="hidden whitespace-nowrap text-right sm:block xl:hidden 2xl:block">
          <span className="block text-sm font-medium leading-none text-foreground">
            {account.username}
          </span>
          <span className="label-caps mt-1 block text-[10px] leading-none text-outline">
            {account.role === "admin" ? "NovaGiv Host" : "Miembro"}
          </span>
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground shadow-[0_0_12px_-2px_rgba(208,188,255,0.4)] sm:bg-primary/20 sm:text-primary sm:shadow-none sm:ring-1 sm:ring-primary/40">
          {account.username.slice(0, 2)}
        </span>
      </Link>

      {/* Phones sign out from /account, behind the «Cuenta» tab. */}
      <form action={signOut} className="hidden sm:block">
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="text-muted-foreground"
        >
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  );
}
