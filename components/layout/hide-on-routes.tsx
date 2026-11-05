"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Renders its (server-rendered) children everywhere except under the given
 * path prefixes. Lets the root layout carry the public header and footer while
 * /admin, which has its own sidebar, opts out.
 *
 * `mobilePrefixes` hides them on phones only: the sign-in and sign-up screens
 * bring their own back/close bar there, while desktop keeps the full header.
 */
export function HideOnRoutes({
  prefixes,
  mobilePrefixes = [],
  children,
}: {
  prefixes: readonly string[];
  mobilePrefixes?: readonly string[];
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (matches(pathname, prefixes)) return null;
  // `contents` keeps the wrapper out of the layout, so a sticky header inside
  // still sticks against the page rather than against this div.
  if (matches(pathname, mobilePrefixes)) return <div className="hidden md:contents">{children}</div>;

  return <>{children}</>;
}
