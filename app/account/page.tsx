import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";

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
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
      >
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {account.username}
            </h1>
            {account.role === "admin" && (
              <Badge variant="secondary">
                <ShieldCheck />
                Admin
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {joinedAt ? `En NovaGiv desde el ${joinedAt}.` : "Tu cuenta de NovaGiv."}
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="mt-6 flex flex-col gap-4">
        <UsernameForm username={account.username} />
        <EmailForm email={account.email} />
        <PasswordForm />
      </div>
    </div>
  );
}
