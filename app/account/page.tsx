import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark, Clock, Heart, LogOut, ShieldCheck } from "lucide-react";

import { EmailForm } from "@/components/account/email-form";
import { PasswordForm } from "@/components/account/password-form";
import { UsernameForm } from "@/components/account/username-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { getAccount } from "@/lib/auth";
import { loginPath } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Mi cuenta | NovaGiv",
};

function formatJoinDate(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export default async function AccountPage() {
  const account = await getAccount();

  // The middleware turns away anyone without a session; this keeps the page
  // honest on its own and narrows the type.
  if (!account) redirect(loginPath("/account"));

  const joinedAt = formatJoinDate(account.createdAt);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
      >
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>

      <header className="relative mt-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-surface-low p-6 ring-1 ring-border">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-lg font-bold uppercase text-primary ring-1 ring-primary/40">
            {account.username.slice(0, 2)}
          </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              @{account.username}
            </h1>
            {account.role === "admin" && (
              <Badge variant="secondary">
                <ShieldCheck />
                Admin
              </Badge>
            )}
          </div>
          <p className="label-code text-outline">
            {joinedAt ? `En NovaGiv desde el ${joinedAt}` : "Tu cuenta de NovaGiv"}
          </p>
        </div>
        </div>

        <div className="relative flex items-center gap-2">
          {account.role === "admin" && (
            <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
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
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link
          href="/me-gusta"
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "h-auto justify-start gap-3 rounded-xl bg-surface-low px-4 py-3 ring-1 ring-border hover:bg-surface"
          )}
        >
          <Heart className="size-5 text-primary" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-medium">Mis me gusta</span>
            <span className="text-xs font-normal text-muted-foreground">Lo que te gustó</span>
          </span>
        </Link>
        <Link
          href="/ver-despues"
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "h-auto justify-start gap-3 rounded-xl bg-surface-low px-4 py-3 ring-1 ring-border hover:bg-surface"
          )}
        >
          <Bookmark className="size-5 text-primary" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-medium">Ver después</span>
            <span className="text-xs font-normal text-muted-foreground">Lo que tienes pendiente</span>
          </span>
        </Link>
        <Link
          href="/historial"
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "h-auto justify-start gap-3 rounded-xl bg-surface-low px-4 py-3 ring-1 ring-border hover:bg-surface"
          )}
        >
          <Clock className="size-5 text-primary" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-medium">Historial</span>
            <span className="text-xs font-normal text-muted-foreground">Seguir viendo</span>
          </span>
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <UsernameForm username={account.username} />
        <EmailForm email={account.email} />
        <PasswordForm />
      </div>
    </div>
  );
}
