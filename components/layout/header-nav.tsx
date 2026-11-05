"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FILTER_TABS, UPCOMING_FILTER_TABS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** "Todos" reads as «Catálogo» up here: it is the way home, not a filter. */
const NAV_LINKS = FILTER_TABS.map((tab) => ({
  value: tab.value,
  label: tab.value === "all" ? "Catálogo" : tab.label,
  href: tab.value === "all" ? "/" : `/?tab=${tab.value}`,
}));

function useActiveTab(): string | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname !== "/") return null;
  return searchParams.get("tab") ?? "all";
}

function PendingTag() {
  return (
    <span className="label-caps rounded bg-surface-highest px-1.5 py-0.5 text-[10px] text-outline normal-case">
      Pronto
    </span>
  );
}

/** The type links of the header. Each one is a catalog URL, so it shares and reloads like the tabs. */
export function HeaderNav() {
  const active = useActiveTab();

  return (
    <nav className="hidden items-center gap-1 xl:flex" aria-label="Secciones">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.value}
          href={link.href}
          scroll={false}
          aria-current={active === link.value ? "page" : undefined}
          className={cn(
            "rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            active === link.value && "font-semibold text-primary hover:text-primary"
          )}
        >
          {link.label}
        </Link>
      ))}
      {UPCOMING_FILTER_TABS.map((tab) => (
        <span
          key={tab.value}
          className="flex cursor-default items-center gap-1.5 px-2 py-1 text-sm font-medium text-muted-foreground/60"
          title="Muy pronto en el catálogo"
        >
          {tab.label.split(" /")[0]}
          <PendingTag />
        </span>
      ))}
    </nav>
  );
}

/**
 * The header's search box. It hands off to the catalog's own search (`?q=`),
 * so it hides itself on the catalog — where the filter bar already has one and
 * two boxes would fight over the same param.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState("");

  if (pathname === "/") return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
  }

  return (
    <form role="search" onSubmit={submit} className={cn("relative w-56", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-outline" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar en el archivo…"
        aria-label="Buscar en el catálogo"
        className="h-9 w-full rounded-lg bg-surface-low pl-8 pr-3 text-sm text-foreground placeholder:text-outline focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </form>
  );
}

/** Phones and tablets: the same links, in a drawer. */
export function MobileNav() {
  const active = useActiveTab();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="xl:hidden" aria-label="Abrir menú" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-surface-lowest">
        <SheetHeader>
          <SheetTitle>NovaGiv</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-3" aria-label="Secciones">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.value}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={active === link.value ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground",
                active === link.value && "bg-primary/15 text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
          {UPCOMING_FILTER_TABS.map((tab) => (
            <span
              key={tab.value}
              className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
            >
              {tab.label}
              <PendingTag />
            </span>
          ))}
        </nav>
        <div className="px-3 pt-4">
          <HeaderSearch className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
