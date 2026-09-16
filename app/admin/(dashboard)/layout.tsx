import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { getAccount } from "@/lib/auth";
import { loginPath } from "@/lib/url";

export const metadata = {
  title: "Panel de administración | NovaGiv",
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getAccount();

  // Middleware already turns away everyone who is not an admin; this is a cheap
  // defense-in-depth check plus it gives us the name to show in the header.
  if (!account) redirect(loginPath("/admin"));
  if (account.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="text-lg font-semibold text-foreground">
            NovaGiv <span className="text-muted-foreground">· Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {account.username}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="size-4" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
