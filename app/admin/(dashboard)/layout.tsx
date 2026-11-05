import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { BrandMark } from "@/components/layout/brand-mark";
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
  // defense-in-depth check plus it gives us the name to show in the sidebar.
  if (!account) redirect(loginPath("/admin"));
  if (account.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-surface-lowest p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <BrandMark href="/admin" suffix="Studio" className="px-1" />

        <AdminNav />

        <div className="mt-auto hidden items-center justify-between gap-2 rounded-lg bg-surface-low p-2 lg:flex">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold uppercase text-primary">
              {account.username.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{account.username}</p>
              <p className="label-caps text-[10px] text-outline">Admin</p>
            </div>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
