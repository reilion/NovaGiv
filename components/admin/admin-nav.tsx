"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CloudDownload, LayoutDashboard, SquarePlus } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Panel de control", icon: LayoutDashboard, exact: true },
  { href: "/admin/import", label: "Importar desde ok.ru", icon: CloudDownload, exact: false },
  { href: "/admin/media/new", label: "Nueva colección", icon: SquarePlus, exact: true },
] as const;

/** The studio's sections. Editing an existing title keeps «Panel de control» lit. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Administración">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href || (href === "/admin" && /^\/admin\/media\/(?!new)/.test(pathname))
          : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_-4px_rgba(208,188,255,0.5)]"
                : "text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground lg:mt-4"
      >
        <ArrowLeft className="size-4" />
        Volver al catálogo
      </Link>
    </nav>
  );
}
