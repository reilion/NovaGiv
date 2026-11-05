"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Renders its (server-rendered) children everywhere except under the given
 * path prefixes. Lets the root layout carry the public header and footer while
 * /admin, which has its own sidebar, opts out.
 */
export function HideOnRoutes({ prefixes, children }: { prefixes: string[]; children: ReactNode }) {
  const pathname = usePathname();
  const hidden = prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return hidden ? null : <>{children}</>;
}
